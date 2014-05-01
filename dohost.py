#! /usr/bin/env python
import os
import json
import threading

class ServerThread(threading.Thread):
    def run(self):
        import web
        
        class Responder(object):
            def GET(self, path):
                if not path:
                    path = 'index.html'
                path = 'testapp/' + path
                
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
                return web.httpserver.runsimple(func, ('0.0.0.0', port))


        app = MyApplication(urls)
        app.run(port=3000)

def run():
    x = ServerThread()
    x.daemon = True
    x.start()

if __name__ == "__main__":
    x = ServerThread()
    x.run()
