from rumps import *

DROPBOX_APP_FOLDER = "/Users/graham/Dropbox/Apps/localhost-dev/"
PORT = 9000

started = False

def print_f(a):
    import webbrowser
    webbrowser.open('http://localhost:8080/')

app = App('localhost_webserver', icon='icon.png')
app.menu = [
    MenuItem('Open', callback=print_f),
    None
]

import dohost
dohost.run()
print 'running'

app.run()
