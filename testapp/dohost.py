#! /usr/bin/env python
from bottle import route, run, static_file
import os
import json
 
@route('/:path#.+#')
def server_static(path):
    if path.endswith('/'):
        path = path.replace('..', '')
        return json.dumps(os.listdir(os.path.abspath(path)))
    else:
        return static_file(path, root='.')
 
import sys
 
if len(sys.argv) > 1:
    port = int(sys.argv[1])
else:
    port = 3000
 
run(host='0.0.0.0', port=port)
