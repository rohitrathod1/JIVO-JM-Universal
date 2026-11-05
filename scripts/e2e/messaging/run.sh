# usage: run.sh <step> <id>   copies step into cmd atomically and waits for the result
cd /c/Users/JIVO/Desktop/JM/JIVO-JM-Universal; R=test-results/e2e/messaging/cmd-results
cp scripts/e2e/messaging/steps/$1.cjs scripts/e2e/messaging/cmd/$2.tmp && mv scripts/e2e/messaging/cmd/$2.tmp scripts/e2e/messaging/cmd/$2.cjs
until [ -f $R/$2.txt ]; do sleep 1; done; cat $R/$2.txt; echo
