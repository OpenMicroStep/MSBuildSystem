if [ $ACTION = 'clean' ]; then
    echo "Cleaning"
    true;/usr/local/bin/node $(dirname $0)/app.js clean $1
else
    true;/usr/local/bin/node $(dirname $0)/app.js make $1
fi