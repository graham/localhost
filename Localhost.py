from rumps import *
import dohost

toggle_dev_menuitem = None
thevars = {'dev':False}

def print_f(a):
    import webbrowser
    webbrowser.open('http://localhost:3000/')

def toggle_dev(a):
    if thevars['dev']:
        dohost.set_prod()
        thevars['dev'] = False
        toggle_dev_menuitem._menuitem.setTitle_("Switch to Development")
    else:
        dohost.set_dev()
        thevars['dev'] = True
        toggle_dev_menuitem._menuitem.setTitle_("Switch to Production")

toggle_dev_menuitem = MenuItem("Switch to Development", callback=toggle_dev)

app = App('localhost_webserver', icon='icon.png')
app.menu = [
    toggle_dev_menuitem,
    MenuItem('Open', callback=print_f),
    None
]


dohost.run()
print 'running'

app.run()
