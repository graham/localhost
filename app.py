from rumps import *

DROPBOX_APP_FOLDER = "/Users/graham/Dropbox/Apps/localhost-dev/"
PORT = 9000

def print_f(a):
    print 'hi', a

app = App('localhost_webserver', icon='icon.png')
app.menu = [
    MenuItem('Open', callback=print_f),
    None
]


app.run()
