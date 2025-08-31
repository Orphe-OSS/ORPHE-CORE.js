/*
テスト
var bles = [new Orphe(0), new Orphe(1)];
var connectedDevices = 0;  // 接続されたデバイスの数を追跡

var totalstep = 0;
var gamepar =0;


bles[0].setup();
buildCoreToolkit(document.querySelector('#toolkit_placeholder1'), '01', 0, 'ANALYSIS');
bles[1].setup();
buildCoreToolkit(document.querySelector('#toolkit_placeholder2'), '02', 1, 'ANALYSIS');
for (let ble of bles) {
    ble.onConnect = function () {
        connectedDevices++;
        if (connectedDevices === 2) {
           //接続されたときの処理
          gamepar = 5;
          

        }
        
      }
    }
    

    
    

function gameStart(){
  
   //console.log("totalstep");
  bles[0].gotStepsNumber = function (steps_number) {
    totalstep += steps_number.value;
    console.log("1:"+steps_number.value);
   }
   bles[1].gotStepsNumber = function (steps_number){
    totalstep += steps_number.value;
    console.log("2:"+steps_number.value);
   }


   
}



*/