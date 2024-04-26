var bles = [new Orphe(0), new Orphe(1)];
var connectedDevices = 0;  // 接続されたデバイスの数を追跡
var gameTimer;
var gameActive = false;  // ゲームがアクティブかどうかを追跡
var previousAcc = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
var totalMovement = 0;
const movementThreshold = 50; // 総動きの閾値
var ltm = 0;
var storeg = 1;
var gamepar =0;
var score_num = 0;
var score_ABCD;
var timer_num;



bles[0].setup();
buildCoreToolkit(document.querySelector('#toolkit_placeholder1'), '01', 0, 'RAW');
bles[1].setup();
buildCoreToolkit(document.querySelector('#toolkit_placeholder2'), '02', 1, 'RAW');
for (let ble of bles) {
    ble.onConnect = function () {
        connectedDevices++;
        if (connectedDevices === 2) {
           // document.getElementById('connectionStatus').innerHTML = '２つのデバイスが接続されました';
          //  document.getElementById('startButton').style.display = 'block';
            gamepar =5;
        }
    };
}

window.onload = function () {
   // document.getElementById('startButton').addEventListener('click', startGame);
   // document.getElementById('retryButton').addEventListener('click', startGame);
}




function startGame() {
    gamepar =1;
    totalMovement = 0; 
   // gamepar =1;
    storeg = 0;


    
  gameActive = true;  // ゲームをアクティブに設定
  //document.getElementById('connectionStatus').innerHTML = "";
  //document.getElementById('startButton').style.visibility = 'hidden';
  //document.getElementById('retryButton').style.visibility = 'hidden';
  //document.getElementById('measurement').style.display = 'block';
 // document.getElementById('measurement').innerHTML = '足をたくさん動かしてください…';
  //document.getElementById('result').innerHTML = '';
  //document.getElementById('timer').style.display = 'block';  // タイマーを表示
  //document.getElementById('timer').innerHTML = '残り: 10 秒';
  totalMovement = 0;
  ltm = 0;
  previousAcc = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];

  let timeLeft = 10;
  const timerId = setInterval(() => {
      timeLeft--;
      timer_num = '残り: ' + timeLeft + ' 秒';
      //document.getElementById('timer').innerHTML = '残り: ' + timeLeft + ' 秒';
      if (timeLeft <= 0) {
          clearInterval(timerId);
          endGame();
      }



  }, 1000);

  bles.forEach((ble, index) => {
      ble.gotAcc = function (acc) {
          if (gameActive && (previousAcc[index].x !== 0 || previousAcc[index].y !== 0 || previousAcc[index].z !== 0)) {
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

  gameTimer = setTimeout(() => {
      clearInterval(timerId);
      endGame();
  }, 10000);
}


//window.startGame = startGame;
//export { startGame };

function endGame() {
    storeg = 1;
    gamepar =2;
  gameActive = false;  // ゲームを非アクティブに設定
 // document.getElementById('measurement').innerHTML = '総動き量: ' + totalMovement.toFixed(2);
 // document.getElementById('retryButton').style.display = 'block';
  //document.getElementById('retryButton').style.visibility = 'visible';
  document.getElementById('timer').style.display = 'none';  // タイマーを非表示にする

  if (totalMovement < 10) {
    score_ABCD = 'D';
      //document.getElementById('result').innerHTML = 'D';
  } else if (totalMovement < 40) {
    score_ABCD = 'C';
     // document.getElementById('result').innerHTML = 'C';
  } else if (totalMovement < 70) {
    score_ABCD = 'B';
     // document.getElementById('result').innerHTML = 'B';
  } else if (totalMovement < 100) {
    score_ABCD = 'A';
     // document.getElementById('result').innerHTML = 'A';
  } else {
    score_ABCD = 'S';
     // document.getElementById('result').innerHTML = 'S';
  }
  score_num = totalMovement;
  //totalMovement = 0;  // totalMovementをリセット
  ltm = 0;
}

