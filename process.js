let fs = require('fs');
const Parser = require('./parser');
const ByteParser = require('./byteParser');

// processCleaned();
// process20190205();
// processStream('files/20190205_084447.log.bin');

// erst so gemacht, dass nicht mehr die logs mit dabei stehen. dann mit makeBin konvertieren
// makeBin('files/20190110_2200_my_mit_druecken.log.clean');
makeBin('files/20190131_095705_simple.log.clean');
// dann den Anfang und Ende auf Packete machen.

processStream('files/20190110_2200_my_mit_druecken.log.clean.bin');


function processCleaned(){
  let contents = fs.readFileSync('./files/cleaned.log');
  // console.log('contents', contents.toString().split('\n'));

  const buf = Buffer.alloc(9376);
  let str = '';
  let arr = contents.toString().split('\n');

  for (let i = 0; i < arr.length; i++) {
    let zeile = arr[i];
    buf.writeInt8(turnCharToNumber(zeile), i);

  }

  fs.writeFileSync('./files/cleaned.bin', buf)

}
function makeBin(fileName){
  let contents = fs.readFileSync(fileName);
  // const buf = Buffer.alloc(contents.length);
  const arr = [];
  let cont = contents.toString();
  for(let i = 0; i < cont.length; i++){
    let val ='';
    if(cont[i] == '\\'){
      switch(cont[i+1]){
        case 'x':
          val = parseInt(cont[i+2] +cont[i+3], 16);
          i+=3;
          break;
        case 'r':
          val = 13;
          i+=1;
          break;
        case 'n':
          val = 10;
          i+=1;
          break;
        default:
          console.log('unknown control sequence:', cont[i+1]);
          process.exit(1);
      }
    }
    else{
      val = cont[i].charCodeAt(0);
    }
    arr.push(val);
  }
  let buf = Buffer.from(arr);
  fs.writeFileSync(fileName + '.bin', buf);
  
}

function processStream(fileName){
  let contents = fs.readFileSync(fileName);
  let oldParser = new ByteParser();
  let as = oldParser.parse(contents);
  fs.writeFileSync(fileName + '.myformat', as);

  let parser = new Parser();
  let newParser = parser.parse(contents);
  newParser = newParser.map(item => item.toJSON())
  fs.writeFileSync(fileName + '.packets', JSON.stringify(newParser, null, 2));
  function onlyUnique(value, index, self) { 
    return self.indexOf(value) === index;
}
  let commands = newParser.filter((item) => !!item.command).map((item) => item.command.toString('hex')).filter(onlyUnique).sort();
  console.log('commands', commands);

  let enqCommands = newParser.filter((item) => !!item.enq).map((item) => item.enq.command).filter(onlyUnique).sort();
  console.log('enqCommands', enqCommands);

  let adressen = newParser.filter((item) => !!item.addr).map((item) => item.addr.toString('hex')).filter(onlyUnique).sort();
  console.log('adressen', adressen);

  let enqAdressen = newParser.filter((item) => !!item.enq).map((item) => item.enq.addr.toString('hex')).filter(onlyUnique).sort();
  console.log('enqAdressen', enqAdressen);
  
}

function process20190205(){
  let contents = fs.readFileSync('./files/20190205_084447_simple.cleaned.log');

  const buf = Buffer.alloc(7856);
  let str = '';
  let arr = contents.toString().split('\n');
  let startTime = new Date('2019-02-05 08:44:47.837');
  for (let i = 0; i < arr.length; i++) {
    let zeile = arr[i];
    // 2019-02-05 08:44:47.837 als basis
    let split = zeile.split('  ');
    let timeDiff = new Date(split[0]) - startTime;
    str += "\n" + `${timeDiff} ${split[1]}`;
    // timediff zu dieser zeit berechnen und aufschreibben
    // die häufigkeit der einzelnen Zeiten aufaddieren um eine Verteilung zu sehen
    buf.writeInt8(turnCharToNumber(split[1]), i);

  }

  fs.writeFileSync('./files/20190205_084447_simple.cleaned.milli.log', str)

  fs.writeFileSync('./files/20190205_084447_simple.cleaned.bin', buf)

}





function turnCharToNumber(input){
  if(input.indexOf('\\') === 0){
    if (input == "\\n") {
      return 10;
    }
    else if (input == "\\t") {
      return 9;
    }
    else{
      if(input.length == 4){
        let num = parseInt(input.slice(2), 16);
        if(num > 127){
          num -= 256
        }
        return num;
      }
      else{
        console.log('input`', input, '` fängt mit \\ an und ist nicht 4 Stellen lang')
        process.exit(1);
      }
    }
  }
  else{
    if(input){
      return input.charCodeAt(0);
    }
    else{
      console.log('input', input, 'fängt nicht mit \\ an und ist leer')
      process.exit(1);
    }
  }
}