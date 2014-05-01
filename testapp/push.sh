#! /bin/bash

export TARGET=$PERSONAL_DB/Apps/site44/pulled.site44.com/

rm master.atom
wget "https://github.com/graham/pulled/commits/master.atom"

cp -vr * $TARGET
