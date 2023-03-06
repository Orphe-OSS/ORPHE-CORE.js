let flg_turn = true;
let flg_drain = true;
let last_timestamp = Date.now();
let HP = 500;
let hpdata = [HP];
let damage;
let damagedata = [];

let total_yaw;
let numOfYaw;
let seisu;

let eulerData = {
    "pitch":[],
    "roll":[],
    "yaw":[]
}
let eulerSum = {
    "pitch":[],
    "roll":[],
    "yaw":[]
}

let sound_gliding = new Audio();
sound_gliding.src = "gliding.mp3";
let sound_attack = new Audio();
sound_attack.src = "attack.mp3";
let sound_explosion = new Audio();
sound_explosion.src = "explosion.mp3";

window.onload = function(){
    bles[0].setup();
    buildCoreToolkit(document.querySelector('#toolkit_placeholder'), 'connect', 0, 'RAW');

    bles[0].gotAcc = function(acc){
        damage = Math.sqrt(acc.x ** 2 + acc.y ** 2) * 200;

        document.querySelector("#damage").innerHTML = damage;

        if(!flg_turn && damage > 3 && (Date.now() - last_timestamp) > 1000 && HP > 0){
            damagedata[0] = damage;
            HP -= damage;
            hpdata[0] = HP;
            last_timestamp = Date.now();
            sound_attack.play();
            d3.select(".hp_bar").data(hpdata).transition().duration(750).attr("width", (d) => xScale(d)).attr("fill", (d) => colorScale(d));
            d3.select(".hp_text").data(hpdata).text((d) => Math.round(d));
            document.querySelector(".orphecore").animate(
                [
                    {
                        offset: 0.00,
                        transform: 'translate(0, 0)'
                    },
                    {
                        offset: 0.05,
                        transform: 'translate(-5%, 0)'
                    },
                    {
                        offset: 0.10,
                        transform: 'translate(5%, 0)'
                    },
                    {
                        offset: 0.15,
                        transform: 'translate(-5%, 0)'
                    },
                    {
                        offset: 0.20,
                        transform: 'translate(5%, 0)'
                    },
                    {
                        offset: 0.25,
                        transform: 'translate(-5%, 0)'
                    },
                    {
                        offset: 0.30,
                        transform: 'translate(0, 0)'
                    },
                    {
                        offset: 1.00,
                        transform: 'translate(0, 0)'
                    }
                ],
                {
                    duration: 1500,
                }
            );
            
            if(HP < 0){
                hpdata[0] = 0;
                sound_explosion.play();
                d3.select(".hp_bar").data(hpdata).transition().duration(750).attr("width", (d) => xScale(d));
                d3.select(".hp_text").data(hpdata).text((d) => Math.round(d));
            }
        }
    }

    bles[0].gotEuler = function(euler){

        
        numOfYaw = 0;

        if(flg_turn) {
            numOfYaw = 0;
            eulerData.yaw.push(Math.abs(euler.yaw));

            if(eulerData.yaw.length > 1){
            eulerSum.yaw.push(Math.abs(eulerData.yaw[eulerData.yaw.length - 1] - eulerData.yaw[eulerData.yaw.length - 2]));
            }

            total_yaw = eulerSum.yaw.reduce((sum, element) => sum + element, 0);
            numOfYaw = total_yaw * 5 / (Math.PI * 2);

            seisu = Math.floor(numOfYaw);

            document.querySelector('#floorPart').innerHTML = seisu;
            document.querySelector('#syosu').innerHTML = Math.round((numOfYaw.toFixed(1) - seisu) * 10);

            document.querySelector("#eulertest").innerHTML = euler.yaw;
            document.querySelector("#rotatetest").innerHTML = numOfYaw;

            /*
            if((Date.now() - last_timestamp) > 1000){
                HP += numOfYaw * 6;
                hpdata[0] = HP;
                last_timestamp = Date.now();
                d3.select(".hp_bar").data(hpdata).transition().duration(750).attr("width", (d) => xScale(d));
                d3.select(".hp_text").data(hpdata).text((d) => Math.round(d));
            }
            */
        }

    }

    bles[0].gotGyro = function(gyro){

        if(flg_turn && gyro.z  > 0.9 && (Date.now() - last_timestamp) > 1000){
            sound_gliding.play();
            bles[0].setLED(1,2);
            setTimeout("bles[0].setLED(0,1)", 2000);
            last_timestamp = Date.now();
        } 
        /*
        if((Date.now() - last_timestamp) > 3000)
        {
            bles[0].setLED(0,1);
        }*/

        if(!flg_turn){
        }
    }
}

function buildElement(name_tag, innerHTML, str_class, str_style, element_appended) {
    let element = document.createElement(name_tag);
    element.innerHTML = innerHTML;
    element.classList = str_class;
    if (str_style != '') {
        element.setAttribute('style', str_style);
    }
    element_appended.appendChild(element);
    return element;
}

const width = 800;
const height = 50;
const svg = d3.select("#hp_gauge").append("svg").attr("width", width).attr("height", height);
const xScale = d3.scaleLinear().domain([0,500]).range([0, width]);
const colorScale = d3.scaleLinear()
  .domain([0, 200, 350, 500])
  .range(["#A31621", "#F6AE2D", "#f5f5f5", "#f5f5f5"])
  .interpolate(d3.interpolateLab);
    
svg.append("rect")
    .data(hpdata)
    .attr("x", 0)
    .attr("y", -40)
    .attr("width", (d) => xScale(d))
    .attr("height", 30)
    .attr("rx", 10)
    .attr("fill", (d) => colorScale(d))
    .attr("class", "hp_bar");

d3.select("#hp_text")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("text")
    .data(hpdata)
    .attr("x", width / 2 - 38)
    .attr("y", height / 2 -30)
    .text((d) => d)
    .attr("font-size", 50)
    .attr("fill", "#f5f5f5")
    .attr("class", "hp_text");

d3.select("#boss")
    .append("svg")
    .attr("width", width)
    .attr("height", 600)
    .append("image")
    .attr("x", 400 - 137)
    .attr("y", 100)
    .attr("xlink:href", "/orphe_core.png")
    .attr("opacity", 0)
    .attr("class", "orphecore");

function turn_switch(){
    flg_turn = !flg_turn;
    console.log(flg_turn);

    if(!flg_turn)
    {
        console.log(eulerSum.yaw);
        console.log(total_yaw);
        document.querySelector('#turnmoniter').innerHTML = "your turn";
    }

    if(flg_turn)
    {
        document.querySelector('#turnmoniter').innerHTML = "boss turn";
    }
    
}

function reset(){
    HP = 500;
    hpdata[0] = HP;
    d3.select(".hp_bar").data(hpdata).transition().duration(750).attr("width", (d) => xScale(d)).attr("fill", (d) => colorScale(d));
    d3.select(".hp_text").data(hpdata).text((d) => Math.round(d));
    
    eulerData.yaw.length = 0;
    eulerSum.yaw.length = 0;

    document.querySelector('#floorPart').innerHTML = 0;
    document.querySelector('#syosu').innerHTML = 0;
    document.querySelector("#rotatetest").innerHTML = numOfYaw;
}

function start(){
    d3.select(".hp_bar").transition().duration(1000).attr("y", 15);
    d3.select(".hp_text").transition().duration(1000).attr("y", height / 2 + 20);
    d3.select(".orphecore").transition().duration(1000).attr("opacity", 1);

    document.querySelector('#turnmoniter').style.display= "block";
    document.querySelector('#turnmoniter').innerHTML = "boss turn";

    var target = document.querySelector('#startButton');
    target.remove();
}

function setup(){
    let cnv = createCanvas(windowWidth, windowHeight);
    cnv.position(0,0);
    cnv.style("z-index", "-1");
}
function draw(){
    background("#3f3f3f")
    if(!flg_turn && damage > 3 && (Date.now() - last_timestamp) > 1000 && HP > 0){
    }
}
    