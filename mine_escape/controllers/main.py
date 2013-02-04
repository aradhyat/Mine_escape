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
import mimetypes
import string
import random
import bleach

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



class GameNamespace(BaseNamespace, BroadcastMixin, RoomsMixin):
    def __init__(self, *args, **kwargs):
        super(GameNamespace, self).__init__(*args, **kwargs)

    def recv_disconnect(self):
        if self.socket.session['con']!=False:
            self.emit_to_other("abort_game","Game aborted byt other user.")
        
        print "disconnected"
        self.broadcast_event("new_players",self.get_allconnects())
        self.disconnect()

    def recv_connect(self):
        self.socket.session['player_name']='Name not set'
        self.socket.session['player_role']=''
        self.socket.session['con']=False
        self.socket.session['score']=0
        print "connected"
        gevent.sleep(3)
        self.broadcast_event("new_players",self.get_allconnects())


    def get_allconnects(self):
        playing=[]
        waiting=[]
        total_Players=0
        for sessid, socket in self.socket.server.sockets.iteritems():
            if 'con' in socket.session.keys():
                if socket.session['con']==False:
                    waiting.append(socket.session['player_name'])
                else:
                    playing.append(socket.session['player_name'])
                total_Players=total_Players+1

        data={
            'playing':playing,
            'waiting':waiting,
            'players':total_Players
        }

        return data

    def emit_to_other(self,event,msg):
        pkt = dict(type="event",
                   name=event,
                   args=msg,
                   endpoint=self.ns_name)
        self.socket.session['con'].send_packet(pkt)

    def on_setname(self, name):

        if bleach.clean(name)!=name:
            self.emit("not_good")
            return

        self.socket.session['player_name']=bleach.clean(name)
        for sessid, socket in self.socket.server.sockets.iteritems():
            if 'player_role' in socket.session.keys():
                if socket.session['player_role']=='player_1' and socket.session['con']==False and self.socket!=socket:
               
                    self.socket.session['player_role']='player_2'
                
                    self.socket.session['con']=socket
                    socket.session['con']=self.socket


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
        print "game over"
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
                    {'/game':GameNamespace},
                    request=request)


    return Response('')

