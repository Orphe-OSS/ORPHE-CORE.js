//Starting point of canvas_placeholder
var mycanvas;
let foot_img = []; // Declare variable image
let normal_image = [];
let overpronation_image = [];
let oversupination_image = [];
let pronation_image = [];
let supination_image = [];
//let pronations = [0,0];//Variable to which the value of pronation is assigned
let pronations = [[0,0,0,0,0],[0,0,0,0,0]];//Variable to which the value of pronation is assigned
let ave_pronations = [77,66];
let states =['NORMAL','NORMAL'];

function setup() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16 * 0.5;
    mycanvas = createCanvas(canvas_width, canvas_height);
    document.querySelector('#canvas_placeholder').appendChild(mycanvas.elt);
    textFont('Roboto');
    textAlign(CENTER);
    foot_img[0] = loadImage('images/normal0.png'); // Load the image
    foot_img[1] = loadImage('images/normal1.png'); // Load the image
    overpronation_image[0] = loadImage('images/overpronation0.png'); // Load the image
    overpronation_image[1] = loadImage('images/overpronation1.png'); // Load the image
    pronation_image[0] = loadImage('images/pronation0.png'); // Load the image
    pronation_image[1] = loadImage('images/pronation1.png'); // Load the image
    normal_image[0] = loadImage('images/normal0.png'); // Load the image
    normal_image[1] = loadImage('images/normal1.png'); // Load the image
    supination_image[0] = loadImage('images/supination0.png'); // Load the image
    supination_image[1] = loadImage('images/supination1.png'); // Load the image
    oversupination_image[0] = loadImage('images/oversupination0.png'); // Load the image
    oversupination_image[1] = loadImage('images/oversupination1.png'); // Load the image
}



function draw() {
    background(200);
    fill(0);



    // calculate the average value 
    let sum = 0;
    for (let i = 0; i < 5; i++) {
    sum += pronations[0][i];
    }
    ave_pronations[0] = sum / 5.0;

    //なぜか平均がエラーになってしまう　ここを解決する必要がある

    textSize(32);
    text(ave_pronations[0].toFixed(2) + "°",width * 0.35, height * 0.8);
    text(ave_pronations[1].toFixed(2) + "°",width * 0.65, height * 0.8);
    text(states[0],width * 0.35, height * 0.95);
    text(states[1],width * 0.65, height * 0.95);
    imageMode(CENTER);
    image(foot_img[0], width * 0.35, height * 0.2, height * 0.9 * foot_img[0].width / foot_img[0].height, height*0.9);
    image(foot_img[1], width * 0.65, height * 0.2, height * 0.9 * foot_img[1].width / foot_img[1].height, height*0.9);


    textSize(16);
    for (let i = 0; i < 2; i++) {
        text("Last 5 values",width * (0.1 + 0.8*i), height * 0.1);
        for (let j = 0; j < pronations[i].length; j++) {
            text(pronations[i][j].toFixed(2) + "°",width * (0.1  + 0.8*i), height * (0.17+0.07*j));
        }
        text("Moving Average",width * (0.1  + 0.8*i), height * 0.6);
        text(ave_pronations[i].toFixed(2),width * (0.1  + 0.8*i), height * 0.67);
    }
}


function keyPressed() {
    if (keyCode === UP_ARROW) {
        pronations[0].unshift(-100.000);
      if (pronations[0].length > 5) {
        pronations[0].pop();
        }
    } else if (keyCode === RIGHT_ARROW) {
        pronations[0].unshift(50.000);
      if (pronations[0].length > 5) {
        pronations[0].pop();
        }
    } else if (keyCode === DOWN_ARROW) {
        pronations[1][1] = 10;
    } else if (keyCode === LEFT_ARROW) {
        pronations[1][1] = 11;
    }
  }


function windowResized() {
    const canvas_width = document.querySelector('#canvas_placeholder').clientWidth;
    const canvas_height = canvas_width * 9 / 16;
    resizeCanvas(canvas_width, canvas_height);
}
//End point of canvas_placeholder




window.onload = function () {
  // bles: defined in coreToolkit.js
  for (let ble of bles) {
    ble.setup();
    ble.onConnect = function (uuid) {
      console.log('onConnect:', uuid);
      document.querySelector(`#status${ble.id}`).innerText = 'ONLINE';
      document.querySelector(`#status${ble.id}`).classList = 'bg-primary text-white'
    }
    ble.onDisconnect = function () {
      document.querySelector(`#status${ble.id}`).innerText = 'OFFLINE';
      document.querySelector(`#status${ble.id}`).classList = 'bg-secondary text-white'
    }

    buildCoreToolkit(document.querySelector('#toolkit_placeholder'),  
    `0${ble.id + 1}`,  
    ble.id, 'ANALYSIS_AND_RAW');

    ble.onConnectGATT = function (uuid) {
      console.log('> connected GATT!');
      document.getElementById(`uuid_name${this.id + 1}`).innerHTML = uuid;
      document.querySelector(`#startNotifications${this.id}`).classList = 'btn btn-danger';
      document.querySelector(`#button_name${this.id}`).innerHTML = "disconnect";
      document.querySelector(`#char${this.id}`).disabled = true;
  }

  ble.onScan = function (deviceName) {
      document.getElementById(`device_name${this.id}`).innerHTML = deviceName;
  }

  ble.gotQuat = function (quat) {
      document.querySelector(`#sq${this.id}_w`).innerHTML = `${quat.w.toFixed(3)}`;
      document.querySelector(`#sq${this.id}_x`).innerHTML = `${quat.x.toFixed(3)}`;
      document.querySelector(`#sq${this.id}_y`).innerHTML = `${quat.y.toFixed(3)}`;
      document.querySelector(`#sq${this.id}_z`).innerHTML = `${quat.z.toFixed(3)}`;
  }


  ble.gotEuler = function (euler) {
    document.querySelector(`#el${this.id}_x`).innerHTML = `${euler.pitch.toFixed(3)}`;
    document.querySelector(`#el${this.id}_y`).innerHTML = `${euler.roll.toFixed(3)}`;
    document.querySelector(`#el${this.id}_z`).innerHTML = `${euler.yaw.toFixed(3)}`;
  }

  ble.gotDelta = function (delta) {
      document.querySelector(`#sd${this.id}_x`).innerHTML = `${delta.x.toFixed(3)}`;
      document.querySelector(`#sd${this.id}_y`).innerHTML = `${delta.y.toFixed(3)}`;
      document.querySelector(`#sd${this.id}_z`).innerHTML = `${delta.z.toFixed(3)}`;
  }

  ble.gotGyro = function (gyro) {
      document.querySelector(`#svg${this.id}_x`).innerHTML = `${gyro.x.toFixed(3)}`;
      document.querySelector(`#svg${this.id}_y`).innerHTML = `${gyro.y.toFixed(3)}`;
      document.querySelector(`#svg${this.id}_z`).innerHTML = `${gyro.z.toFixed(3)}`;
  }

  ble.gotAcc = function (acc) {
      document.querySelector(`#sva${this.id}_x`).innerHTML = `${acc.x.toFixed(3)}`;
      document.querySelector(`#sva${this.id}_y`).innerHTML = `${acc.y.toFixed(3)}`;
      document.querySelector(`#sva${this.id}_z`).innerHTML = `${acc.z.toFixed(3)}`;
  }

  ble.gotGait = function (gait) {
      document.querySelector(`#gait${this.id}_w`).innerHTML = gait.type;
      document.querySelector(`#gait${this.id}_x`).innerHTML = gait.direction;
      document.querySelector(`#gait${this.id}_y`).innerHTML = gait.calorie.toFixed(3);
      document.querySelector(`#gait${this.id}_z`).innerHTML = gait.distance.toFixed(3);
  }
  ble.gotStride = function (stride) {

      document.querySelector(`#stride${this.id}_x`).innerHTML = stride.x.toFixed(3);
      document.querySelector(`#stride${this.id}_y`).innerHTML = stride.y.toFixed(3);
      document.querySelector(`#stride${this.id}_z`).innerHTML = stride.z.toFixed(3);
  }
  ble.gotFootAngle = function (foot_angle) {
      document.querySelector(`#stride${this.id}_w`).innerHTML = foot_angle.value.toFixed(3);
  }
  ble.gotPronation = function (pronation) {
      document.querySelector(`#pronation${this.id}_x`).innerHTML = pronation.x.toFixed(3);
      document.querySelector(`#pronation${this.id}_y`).innerHTML = pronation.y.toFixed(3);
      document.querySelector(`#pronation${this.id}_z`).innerHTML = pronation.z.toFixed(3);
      
      //code inserted for this example
      //pronations[this.id][0] = pronation.y.toFixed(3);
      pronations[this.id][0] = pronation.y;
      pronations[this.id].unshift(pronation.y);
      if (pronations[this.id].length > 5) {
        pronations[this.id].pop();
        }
        
    // calculate the average value 
        let sum = 0;
        for (let i = 0; i < 5; i++) {
        sum += pronations[this.id][i];
        }
        ave_pronations[this.id] = sum / 5.0;

        if(20 <= ave_pronations[this.id]){
            states[this.id]= 'OVER PRONATION';
            foot_img[this.id] = overpronation_image[this.id];
        }else if(10 < ave_pronations[this.id] && ave_pronations[this.id] < 20){
            states[this.id]= 'PRONATION';
            foot_img[this.id] = pronation_image[this.id];
        }else if(-10 <= ave_pronations[this.id] && ave_pronations[this.id] <= 10){
            states[this.id]= 'NORMAL';
            foot_img[this.id] = normal_image[this.id];
        }else if(-20 < ave_pronations[this.id] && ave_pronations[this.id] < -10){
            states[this.id]= 'SUPINATION';
            foot_img[this.id] = supination_image[this.id];
        }else {
            states[this.id]= 'OVER SUPINATION';
            foot_img[this.id] = oversupination_image[this.id];
        }

    //   if(20 <= pronation.y){
    //         states[this.id]= 'OVER PRONATION';
    //         foot_img[this.id] = overpronation_image[this.id];
    //     }else if(10 < pronation.y && pronation.y < 20){
    //         states[this.id]= 'PRONATION';
    //         foot_img[this.id] = pronation_image[this.id];
    //     }else if(-10 <= pronation.y && pronation.y <= 10){
    //         states[this.id]= 'NORMAL';
    //         foot_img[this.id] = normal_image[this.id];
    //     }else if(-20 < pronation.y && pronation.y < -10){
    //         states[this.id]= 'SUPINATION';
    //         foot_img[this.id] = supination_image[this.id];
    //     }else {
    //         states[this.id]= 'OVER SUPINATION';
    //         foot_img[this.id] = oversupination_image[this.id];
    //     }
  }
  ble.gotLandingImpact = function (landing_impact) {
      document.querySelector(`#pronation${this.id}_w`).innerHTML = landing_impact.value.toFixed(3);
  }

  ble.onStartNotify = function (uuid) {
      console.log('> Start Notify!');
      document.getElementById(`uuid_name${this.id}`).innerHTML = uuid;
  }

  ble.onStopNotify = function (uuid) {
      console.log('> Stop Notify!');
      //document.getElementById('uuid_name').innerHTML = uuid;
  }
}
}

