#! /usr/bin/env python
from bottle import route, run, static_file
import bottle
import os
import json
import threading

class ServerThread(threading.Thread):
    def run(self):
        @route('/:path#.+#')
        def server_static(path):
            if path.endswith('/'):
                path = path.replace('..', '')
                path += 'index.html'
                return json.dumps(os.listdir(os.path.abspath(path)))
            else:
                return static_file(path, root='.')

        bottle.run()

def run():
    x = ServerThread()
    x.daemon = True
    x.start()
