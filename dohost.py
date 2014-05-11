#! /usr/bin/env python
import os
import json
import threading

d = {}

d['root'] = os.environ['HOME'] + '/DropboxPersonal/Apps/site44/pulled.site44.com/'

def set_dev():
    d['root'] = os.environ['HOME'] + '/DropboxPersonal/Apps/site44/pulled-dev.site44.com/'

def set_prod():
    d['root'] = os.environ['HOME'] + '/DropboxPersonal/Apps/site44/pulled.site44.com/'

class ServerThread(threading.Thread):
    def run(self):
        import web
        
        class Responder(object):
            def GET(self, path):
                if not path:
                    path = 'index.html'
                path = d['root'] + path

                if not os.path.exists(path):
                    return 404, "Not Found"
                else:
                    return open(path.replace('..','.'))

        urls = (
            '/(.*)', Responder
        )

        class MyApplication(web.application):
            def run(self, port=8080, *middleware):
                func = self.wsgifunc(*middleware)
                return web.httpserver.runsimple(func, ('127.0.0.1', port))


        app = MyApplication(urls)
        app.run(port=3000)

def run():
    x = ServerThread()
    x.daemon = True
    x.start()

if __name__ == "__main__":
    x = ServerThread()
    x.run()
