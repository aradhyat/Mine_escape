from pyramid.config import Configurator
from sqlalchemy import engine_from_config
from pyramid.authentication import AuthTktAuthenticationPolicy
from pyramid.authorization import ACLAuthorizationPolicy
from pyramid.session import UnencryptedCookieSessionFactoryConfig
from pyramid.security import *
from pyramid.response import Response
from pyramid.view import view_config
from pyramid.renderers import render
from pyramid.events import *
import pyramid.httpexceptions as exc
import os
from mine_escape.controllers.main import *

from gevent import monkey


def simple_route(config, name, url, fn):
    """
    Function to simplify creating routes in pyramid
    Takes the pyramid configuration, name of the route, url, and view
    function.
    """
    config.add_route(name, url)
    config.add_view(fn, route_name=name,
            renderer="views/%s.html" % name)


def main(global_config, **settings):
    """ This function returns a Pyramid WSGI application.
    """
    monkey.patch_all()
    config = Configurator(settings=settings)
    config.add_static_view('static', 'static', cache_max_age=3600)
    config.add_static_view('lib','lib')
    config.add_static_view('data','data')
    config.add_static_view('audio','audio')
    config.add_static_view('images','images')
    config.add_static_view('css','css')
    config.add_static_view('js','js')
    config.add_static_view('img','img')
    config.add_renderer('.html','pyramid.mako_templating.renderer_factory')
    
    config.add_route('index','/')
    config.add_route('game','/game')

    # The socketio view configuration
    simple_route(config, 'socket_io', 'socket.io/*remaining', socketio_service)

    config.scan()
    return config.make_wsgi_app()

