var bles = [new Orphe(0), new Orphe(1)];
var connectedDevices = 0;  // 接続されたデバイスの数を追跡

var totalstep = 0;
var gamepar =0;
let canReset = true; // リセット可能かどうかを追跡するフラグ

bles[0].setup();
buildCoreToolkit(document.querySelector('#toolkit_placeholder1'), '01', 0, 'RAW');
bles[1].setup();
buildCoreToolkit(document.querySelector('#toolkit_placeholder2'), '02', 1, 'RAW');
for (let ble of bles) {
    ble.onConnect = function () {
        connectedDevices++;
        if (connectedDevices === 2) {
           //接続されたときの処理
          gamepar = 5;
          

        }
        
      }
    }


    

    
    var ltm = 0;
    var previousAcc = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
    var totalMovement = 0;
    var ltmcount = 0;

function gameStart(){


  bles.forEach((ble, index) => {
    ble.gotAcc = function (acc) {
        if ((previousAcc[index].x !== 0 || previousAcc[index].y !== 0 || previousAcc[index].z !== 0)) {
          
          totalMovement += Math.abs(acc.x - previousAcc[index].x) +
                                     Math.abs(acc.y - previousAcc[index].y) +
                                     Math.abs(acc.z - previousAcc[index].z);
           ltm = Math.abs(acc.x - previousAcc[index].x) +
           Math.abs(acc.y - previousAcc[index].y) +
           Math.abs(acc.z - previousAcc[index].z);
        }
        previousAcc[index] = { ...acc };
    };
});



maybeReset(0.06,300);
  /*

  bles[0].gotStepsNumber = function (steps_number) {
    totalstep += 1;
   // console.log(totalstep);

   if(gamepar === 3){
    UDON_UGOKU();
    punisoundplay();
   }
  
    
   }
   bles[1].gotStepsNumber = function (steps_number){
    totalstep += 1;
   // console.log(totalstep);

    
   if( gamepar === 3){
    UDON_UGOKU();
    punisoundplay();
   }
   }


  */
}




function maybeReset(maxltm,times) {
  if (ltm >maxltm && canReset) {
      //console.log("リセット");
      UDON_UGOKU();
      punisoundplay();
      totalstep += 1;
      canReset = false; // リセット後はフラグを下げる
      setTimeout(() => {
          canReset = true; // 1秒後にフラグをリセット
      }, times); // 1000ミリ秒 = 1秒
  }
}