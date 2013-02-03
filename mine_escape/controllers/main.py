import xml.etree.ElementTree as et
import json
import urllib2
import urllib
import zipfile
import requests
import transaction
import os
import PIL.Image as Image
import hashlib
from pyramid.response import Response
from pyramid.view import view_config
from sqlalchemy.exc import DBAPIError
from atracker.models.models import *
import mimetypes
import string
import random

from gevent import monkey; monkey.patch_all()
import gevent
from socketio.namespace import BaseNamespace
from socketio import socketio_manage
from socketio.mixins import (BroadcastMixin)

@view_config(route_name='index',renderer="views/intro.html")
def index(request):
    """ Base view to load our template """
    return {}

@view_config(route_name='game',renderer="views/index.html")
def game(request):
    return {}



class RoomsMixin(object):
    def __init__(self, *args, **kwargs):
        super(RoomsMixin, self).__init__(*args, **kwargs)
        self.socket.session['roomname']=''
        if 'rooms' not in self.socket.session:
            self.socket.session['rooms'] = set()  # a set of simple strings

    def join(self, room):
        """Lets a user join a room on a specific Namespace."""
        self.socket.session['roomname']=self._get_room_name(room)
        self.socket.session['rooms'].add(self._get_room_name(room))

    def leave(self, room):
        """Lets a user leave a room on a specific Namespace."""
        self.socket.session['rooms'].remove(self._get_room_name(room))

    def _get_room_name(self, room):
        return self.ns_name + '_' + room

    def emit_to_room(self, room, event, *args):
        """This is sent to all in the room (in this particular Namespace)"""
        pkt = dict(type="event",
                   name=event,
                   args=args,
                   endpoint=self.ns_name)
        room_name = room
        for sessid, socket in self.socket.server.sockets.iteritems():
            if room_name == socket.session['roomname'] and self.socket!=socket:
                socket.send_packet(pkt)



class ChatNamespace(BaseNamespace, RoomsMixin, BroadcastMixin):

    def __init__(self, *args, **kwargs):
        super(ChatNamespace, self).__init__(*args, **kwargs)
        self.socket.session['nickname']=''
        self.socket.session['pinfo']={'name':'default','connected':False,'x':0,'y':0}

    def on_setname(self, nickname):
        self.environ.setdefault('nicknames', []).append(nickname)
        self.socket.session['nickname'] = nickname
        self.broadcast_event('announcement', '%s has connected' % nickname)
        self.broadcast_event('nicknames', self.environ['nicknames'])
        # Just have them join a default-named room

    def recv_connect(self):
       ss=self.socket.session['pinfo']
       print ss
       for sessid, socket in self.socket.server.sockets.iteritems():
        if socket.session['pinfo']['name']=='player_1' and self.socket!=socket:
            ss['name']='player_2'
            ss['connected']=True
            ss['x']=600
            ss['y']=100
            ss['xx']=410
            ss['yy']=90
            socket.session['pinfo']['connected']=True

            data={
            'name':socket.session['pinfo']['name'],
            'x':socket.session['pinfo']['x'],
            'y':socket.session['pinfo']['y'],
            'xx':socket.session['pinfo']['xx'],
            'yy':socket.session['pinfo']['yy']
            }
            
            self.emit("user_connect",ss)
            pkt = dict(type="event",
                   name="user_connect",
                   args=data,
                   endpoint=self.ns_name)
            socket.send_packet(pkt)
        
        else:
            ss['name']='player_1'
            ss['x']=410
            ss['y']=90
            ss['xx']=600
            ss['yy']=100


    def on_user_message(self, msg):
        self.emit_to_room(self.socket.session['roomname'], 'chat', self.socket.session['nickname']+" : "+msg)

    def on_join_room(self, room):
    	self.join(room)
        online_users=[]
        for sessid, socket in self.socket.server.sockets.iteritems():
            if self.socket.session['roomname']==socket.session['roomname']:
                online_users.append(socket.session['nickname'])

        self.emit_to_room(self.socket.session['roomname'],'online_users',self.socket.session['nickname'])

    def on_destroy(self, msg):
        print msg

    def on_change_enemy(self,msg):
        print msg
        self.broadcast_event("new_enemy_pos",msg)

    def on_player_die(self):
        for sessid, socket in self.socket.server.sockets.iteritems():
            if self.socket!=socket:
                pkt=dict(type="event",
                    name="destroy_player",
                    args='',
                    endpoint=self.ns_name
                    )
                socket.send_packet(pkt)

    def on_enemy_die(self,msg):
        for sessid, socket in self.socket.server.sockets.iteritems():
            if self.socket!=socket:
                pkt=dict(type="event",
                    name="destroy_enemy",
                    args=msg,
                    endpoint=self.ns_name
                    )
                print pkt
                socket.send_packet(pkt)

    def on_win_game(self):
        for sessid, socket in self.socket.server.sockets.iteritems():
            if self.socket!=socket:
                pkt=dict(type="event",
                    name="game_over",
                    args='',
                    endpoint=self.ns_name
                    )
                socket.send_packet(pkt)



    def on_moving(self,msg):

        for sessid, socket in self.socket.server.sockets.iteritems():
            if self.socket!=socket:
                pkt=dict(type="event",
                    name="mov",
                    args=msg,
                    endpoint=self.ns_name
                    )
                socket.send_packet(pkt)

    def on_image_pos(self, pos):
        top=pos['top']
        left=pos['left']
        self.emit_to_room(self.socket.session['roomname'],"new_pos",{'top':top,'left':left})


    def recv_message(self, message):
        print "PING!!!", message


class GameNamespace(BaseNamespace, BroadcastMixin, RoomsMixin):
    def __init__(self, *args, **kwargs):
        super(GameNamespace, self).__init__(*args, **kwargs)
        self.socket.session['player_name']=''
        self.socket.session['player_role']=''
        self.socket.session['connected_to']=False
        self.socket.session['score']=0

    def recv_disconnect(self):

        for sessid, socket in self.socket.server.sockets.iteritems():
            if self.socket.session['connected_to']==socket.session['connected_to'] and self.socket!=socket:
                socket.session['connected_to']=False
                socket.session['player_role']='player_1'
                pkt=dict(type="event",
                    name="abort_game",
                    args="Game aborted by other user.",
                    endpoint=self.ns_name
                    )
                socket.send_packet(pkt)
        self.broadcast_event("new_players",self.get_allconnects())
        self.disconnect()


    def get_allconnects(self):
        playing=[]
        waiting=[]
        total_Players=len(self.socket.server.sockets)
        for sessid, socket in self.socket.server.sockets.iteritems():
            if socket.session['connected_to']==False:
                waiting.append(socket.session['player_name'])
            else:
                playing.append(socket.session['player_name'])

        data={
            'playing':playing,
            'waiting':waiting,
            'players':total_Players
        }

        return data



    def recv_connect(self):
        self.emit("enter_name")

    def emit_to_other(self,event,msg):

        for sessid, socket in self.socket.server.sockets.iteritems():
            if self.socket.session['connected_to']==socket.session['connected_to'] and self.socket!=socket:
                pkt=dict(type="event",
                    name=event,
                    args=msg,
                    endpoint=self.ns_name
                    )
                if event=='destroy_diamond': print pkt
                socket.send_packet(pkt)


    def on_setname(self, name):
        self.socket.session['player_name']=name
        for sessid, socket in self.socket.server.sockets.iteritems():
            if socket.session['player_role']=='player_1' and socket.session['connected_to']==False and socket.session['player_name']!='' and self.socket!=socket:
               
                self.socket.session['player_role']='player_2'
               
                roomname=''.join(random.choice(string.ascii_uppercase + string.digits) for x in range(5))
                self.socket.session['connected_to']=roomname
                socket.session['connected_to']=roomname

                p1={
                    'player_name':self.socket.session['player_name'],
                    'player_2_name':socket.session['player_name'],
                    'role':'player_1',
                    'x':290,
                    'y':1980,
                    'xx':1090,
                    'yy':1980
                }

                p2={
                    'player_name':socket.session['player_name'],
                    'player_2_name':self.socket.session['player_name'],
                    'role':'player_2',
                    'x':1090,
                    'y':1980,
                    'xx':290,
                    'yy':1980
                }

                self.emit("new_game",p1)
                self.emit_to_other("new_game",p2)
            else :
                self.socket.session['player_role']='player_1'
                self.emit("waiting_for_game")

        self.broadcast_event("new_players",self.get_allconnects())


    def on_new_player_pos(self, data):
        self.emit_to_other("new_player_pos",data)

    def on_game_over(self):
        self.emit_to_other("game_over",'');

    def on_new_enemy_pos(self,data):
        def test():
            self.emit_to_other("new_enemy_pos",data)
        self.spawn(test)

    def on_enemy_died(self, data):
        self.emit_to_other("enemy_died",data)

    def on_player_died(self):
        self.emit_to_other("player_died",'')

    def on_create_diamond(self,data):
        self.emit_to_other("create_diamond",data)

    def on_destroy_diamond(self, data):
        self.socket.session['score']=self.socket.session['score']+1
        self.emit_to_other("destroy_diamond",data)

from pyramid.response import Response
def socketio_service(request):
    socketio_manage(request.environ,
                    {'/chat': ChatNamespace,'/game':GameNamespace},
                    request=request)


    return Response('')

