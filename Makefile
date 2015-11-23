BIN := node_modules/.bin

all: index.js

%.js: %.ts $(BIN)/tsc
	$(BIN)/tsc

$(BIN)/tsc $(BIN)/mocha:
	npm install

test: index.js $(BIN)/mocha
	$(BIN)/mocha --compilers js:babel-core/register tests/
