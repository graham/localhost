from rumps import *

def print_f(a):
    import webbrowser
    webbrowser.open('http://localhost:3000/')

app = App('localhost_webserver', icon='icon.png')
app.menu = [
    MenuItem('Open', callback=print_f),
    None
]

import dohost
dohost.run()
print 'running'

app.run()
