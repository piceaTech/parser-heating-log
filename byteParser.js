module.exports = class ByteParser {
  constructor(options = {replaceChars: false, padPos:4 }) {
    console.log(options);
    this.replaceChars = options.replaceChars;
    this.padPos = options.padPos;
    this.currentString = '';
    this.replaceDictionary = this._getReplaceDict();
    this.replaceKeys = Object.keys(this.replaceDictionary);
    this.lastWasEtx = false;
    this.stringForFile = "";
    
    this.addresses = {};
    this.pos = 0;
  }
  parse(contents) {
    // parses every bbyte on its own
    for (let i = 0; i < contents.length; i++) {
      const value = contents[i]
      this.currentString += this._numToOutput(value);
      if (value === 3 && contents[i-1] == 6) {
        if (this.lastWasEtx) {
          this.lastWasEtx = false;
        }

        this.lastWasEtx = true;



        this.stringForFile += "\n" + this._printPos() + ": " + this.currentString;
        this._findAddr();
        this.pos = i + 1;
        this.currentString = "";
      }
    }
    console.log(this.addresses);
    return this.stringForFile;
  }
  _findAddr(){
    let addr = this.currentString.slice(0,4);
    if(!this.addresses[addr]){
      this.addresses[addr] = 1;
    }
    else{
      this.addresses[addr]++;
    }
  }
  _printPos(){
    let pos = this.pos.toString();
    while(pos.length < this.padPos){
      pos = "0" + pos;
    }
    return pos;
  }
  _numToOutput(value) {
    if (this.replaceKeys.includes("" + value)) {
      return this.replaceDictionary[value]
    }
    if (this.replaceChars && value >= 32 && value <= 126) {
      return String.fromCharCode(value);
    }
    let toReturn = value.toString(16);
    return toReturn.length == 1 ? "0" + toReturn : toReturn;
  }

  _getReplaceDict() {
    return {
      3: "(ETX:3)",
      6: "(ACK:6)",
      10: "(LF:10)",
      5: "(ENQ:5)",
    }
  }
}