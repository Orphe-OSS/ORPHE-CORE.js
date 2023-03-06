
        var input = {
            x:[],
            y:[],
            z:[]
        }
        
        let gesture_x = {
            next:[0.00360107421875, 0.000732421875, 0.0035400390625, 0.0037841796875, 0.00408935546875, 0.0013427734375, -0.00042724609375, 0.00372314453125, 0.00042724609375, 0.0003662109375, 0.00384521484375, 0.0113525390625, 0.006103515625, -0.00213623046875, -0.00250244140625, -0.01544189453125, -0.0478515625, -0.01336669921875, 0.1146240234375, -0.0299072265625, 0.00836181640625, -0.00030517578125, 0.02655029296875, 0.0491943359375, 0.04205322265625, 0.01605224609375, -0.0062255859375, -0.00640869140625, -0.0045166015625, -0.00439453125, 0.01171875, -0.00531005859375, -0.00762939453125, -0.000244140625, 0.00054931640625, 0.000244140625, 0.00274658203125, 0.00115966796875,],
            back:[-0.00335693359375, -0.002197265625, 0.00079345703125, -0.0015869140625, -0.00164794921875, -0.00244140625, -0.0029296875, -0.0035400390625, 0.0018310546875, 0.001220703125, 0.00140380859375, -0.0015869140625, 0.0006103515625, 0.00067138671875, -0.0020751953125, -0.00933837890625, -0.03857421875, -0.0252685546875, 0.0040283203125, 0.00494384765625, -0.07452392578125, -0.0625, 0.1348876953125, -0.00445556640625, 0.00262451171875, 0.0198974609375, 0.02288818359375, 0.04046630859375, -0.00067138671875, -0.00885009765625, -0.0113525390625, -0.0078125, -0.0069580078125, -0.00726318359375, -0.00872802734375, -0.00689697265625, -0.004638671875],
            nothing:[0.00262451171875, 0.001953125, 0.0023193359375, 0.001953125, 0.0029296875, 0.00262451171875, 0.00177001953125, 0.0008544921875, 0.00164794921875, 0.00177001953125, 0.00244140625, 0.00140380859375, 0.0009765625, 0.00115966796875, 0.001220703125, 0.00152587890625, 0.0015869140625, 0.001220703125, 0.00152587890625, 0.0015869140625, 0.00189208984375, 0.001708984375, 0.002197265625, 0.0023193359375, 0.0020751953125, 0.00201416015625, 0.001708984375, 0.001708984375, 0.0013427734375, 0.00164794921875, 0.001220703125, 0.00091552734375, 0.00079345703125, 0.0008544921875, 0.00091552734375, 0.00128173828125, 0.00115966796875, 0.00128173828125, 0.0010986328125, 0.001220703125, 0.0018310546875]
        }

        let gesture_y = {
            next:[-0.00421142578125, -0.01129150390625, -0.00299072265625, 0.000244140625, -0.00408935546875, 0.00457763671875, 0.0045166015625, -0.00433349609375, -0.0009765625, 0.01025390625, 0.006591796875, 0.03436279296875, 0.041748046875, 0.00421142578125, 0.218505859375, 0.01043701171875, -0.18975830078125, 0.28912353515625, -0.12841796875, -0.30419921875, -0.00750732421875, 0.0731201171875, -0.1461181640625, 0.02325439453125, 0.15313720703125, 0.06488037109375, 0.005859375, -0.0595703125, -0.00555419921875, 0.0482177734375, -0.00738525390625, -0.0576171875, -0.02960205078125, 0.008056640625, 0.00482177734375, -0.00543212890625, 0.0172119140625, 0.0155029296875, 0.00048828125, -0.0029296875],
            back:[0.00311279296875, 0.0001220703125, 0.00213623046875, -0.00250244140625, -0.003662109375, -0.00238037109375, -0.00299072265625, 0.0028076171875, 0.01641845703125, -0.0281982421875, -0.04205322265625, -0.05560302734375, 0.023193359375, -0.13116455078125, 0.288330078125, -0.12115478515625, -0.1563720703125, -0.13079833984375, 0.0728759765625, 0.00152587890625, -0.046142578125, 0.03375244140625, 0.029541015625, 0.00286865234375, 0.0107421875, 0.00323486328125, 0.0042724609375, 0.0072021484375, 0.0157470703125, 0.0074462890625, 0.0013427734375, -0.00396728515625, -0.004638671875, -0.003662109375],
            nothing:[0.00006103515625, -0.00164794921875, -0.00341796875, -0.00250244140625, -0.00128173828125, -0.001220703125, -0.003662109375, -0.00091552734375, 0, 0.0001220703125, -0.000244140625, 0.00262451171875, 0.00274658203125, -0.00128173828125, -0.001708984375, -0.000244140625, -0.0006103515625, -0.00250244140625, -0.0013427734375, -0.00054931640625, -0.000732421875, -0.00018310546875, 0.000732421875, -0.00225830078125, -0.0020751953125, 0.0006103515625, -0.00067138671875, 0.000732421875, 0.00140380859375, 0.0040283203125, 0.00152587890625, 0.0008544921875, 0.00006103515625, -0.00177001953125, -0.001708984375, -0.00201416015625, 0.00006103515625, 0.00042724609375, 0.00152587890625, 0.0018310546875, 0.0028076171875, -0.0008544921875, -0.0023193359375]
        }

        let gesture_z = {
            next:[-0.00213623046875, -0.00506591796875, -0.002685546875, -0.00146484375, 0.00048828125, -0.0001220703125, -0.0020751953125, -0.00506591796875, -0.00079345703125, -0.02899169921875, -0.06475830078125, 0.01324462890625, 0.07421875, 0.053955078125, 0.024658203125, 0.02606201171875, 0.0240478515625, -0.01971435546875, -0.01104736328125, -0.02618408203125, -0.019287109375, -0.01708984375, -0.009521484375, -0.001708984375, -0.00030517578125, 0.00592041015625, 0.0093994140625, 0.00537109375, 0.0013427734375, -0.0013427734375, -0.0047607421875, -0.0035400390625, -0.0047607421875, -0.00421142578125, -0.00177001953125, -0.00048828125, 0.0010986328125, 0.000732421875, -0.001220703125],
            back:[0.0037841796875, 0.00164794921875, -0.01031494140625, -0.0089111328125, -0.00079345703125, 0.01092529296875, -0.0018310546875, 0.00128173828125, -0.00439453125, -0.00152587890625, -0.001708984375, -0.0029296875, -0.00396728515625, -0.002685546875, -0.0157470703125, -0.002197265625, 0.01519775390625, 0.00384521484375, -0.057373046875, 0.04339599609375, -0.0614013671875, 0.05206298828125, 0.01251220703125, 0.0478515625, -0.00335693359375, 0.0020751953125, -0.00115966796875, -0.03277587890625, -0.01727294921875, 0.00592041015625, 0.01324462890625, 0.013916015625, 0.0162353515625, 0.01654052734375, 0.00665283203125,],
            nothing:[-0.00189208984375, -0.00115966796875, -0.00146484375, 0.00042724609375, 0.00079345703125, 0.000244140625, -0.00103759765625, -0.0025634765625, -0.00140380859375, 0, 0.00030517578125, 0.00042724609375, -0.00103759765625, -0.001708984375, -0.0008544921875, -0.00164794921875, 0, 0.00006103515625, 0.00054931640625, -0.00042724609375, -0.0023193359375, -0.00164794921875, -0.0001220703125, 0.00006103515625, 0.0001220703125, -0.000732421875, -0.00189208984375, -0.00030517578125, -0.00177001953125, -0.00067138671875, -0.0008544921875, -0.0008544921875, -0.001220703125, -0.00335693359375, -0.00189208984375, -0.0010986328125, 0.00140380859375, -0.0013427734375, -0.0013427734375, -0.00164794921875, 0.00054931640625, 0.00079345703125, -0.00238037109375, -0.00189208984375, -0.0025634765625, -0.00042724609375, -0.00103759765625, -0.0010986328125, -0.001708984375]
        }

        var distFunc = function(a,b){
            return Math.abs(a - b);
        }
        
        let flg_show_x = false;
        let flg_show_y = false;
        let flg_show_z = false;

        var flg_num;
        var past_flg_num;
        var flg_ges;

        let dtw = new DynamicTimeWarping();
        function setup() {

            // createCanvas(512, 512);
        }
        // function draw() {
        //     background(155);
        //     let x = 0;
        //     /*
        //     X: red
        //     Y: green
        //     Z: blue
        //     */
        //     noFill();
        //     stroke(150, 0, 0);
        //     beginShape();
        //     for (let g of mygyro) {
        //         vertex(x, 200 * g.x + 150);
        //         x++;
        //     }
        //     endShape();

        //     x = 0;
        //     stroke(0, 150, 0);
        //     beginShape();
        //     for (let g of mygyro) {
        //         vertex(x, 200 * g.y + 150);
        //         x++;
        //     }
        //     endShape();

        //     x = 0;
        //     stroke(0, 0, 150);
        //     beginShape();
        //     for (let g of mygyro) {
        //         vertex(x, 200 * g.z + 150);
        //         x++;
        //     }
        //     endShape();

        // }

        var mygyro = [];
        window.onload = function () {

            // ORPHE CORE Init
            bles[0].setup();
            buildCoreToolkit(document.querySelector('#toolkit_placeholder'), '01', 0, 'RAW');

            var timestamp_trigger = millis();

            bles[0].gotAcc = function (acc) {

            }
            bles[0].gotGyro = function (gyro) {
                mygyro.push(gyro);
                while (mygyro.length > 500) {
                    mygyro.shift();
                }
                input.x.push(gyro.x);
                while (input.x.length > 50) {
                    input.x.shift();
                }

                input.y.push(gyro.y);
                while (input.y.length > 50) {
                    input.y.shift();
                }

                input.z.push(gyro.z);
                while (input.z.length > 50) {
                    input.z.shift();
                }

                if(input.z.length == 50){
                   let dtw1_x = new DynamicTimeWarping(input.x,gesture_x.next,distFunc);
                   let dtw1_y = new DynamicTimeWarping(input.y,gesture_y.next,distFunc);
                   let dtw1_z = new DynamicTimeWarping(input.z,gesture_z.next,distFunc);
                   let dtw2_x = new DynamicTimeWarping(input.x,gesture_x.back,distFunc);
                   let dtw2_y = new DynamicTimeWarping(input.y,gesture_y.back,distFunc);
                   let dtw2_z = new DynamicTimeWarping(input.z,gesture_z.back,distFunc);
                   let dtw3_x = new DynamicTimeWarping(input.x,gesture_x.nothing,distFunc);
                   let dtw3_y = new DynamicTimeWarping(input.y,gesture_y.nothing,distFunc);
                   let dtw3_z = new DynamicTimeWarping(input.z,gesture_z.nothing,distFunc);
                   let d1_x = dtw1_x.getDistance();
                   let d1_y = dtw1_y.getDistance();
                   let d1_z = dtw1_z.getDistance();
                   let d2_x = dtw2_x.getDistance();
                   let d2_y = dtw2_y.getDistance();
                   let d2_z = dtw2_z.getDistance();
                   let d3_x = dtw3_x.getDistance();
                   let d3_y = dtw3_y.getDistance();
                   let d3_z = dtw3_z.getDistance();


                   if(((d1_x < d2_x && d1_x < d3_x) && (d1_y < d2_y && d1_y < d3_y) && (d1_z < d2_z && d1_z < d3_z)) && ((millis() - timestamp_trigger) > 100)){
                    if(d1_x < 3 && d1_y < 3 && d1_z < 3){
                        // console.log('next');
                        timestamp_trigger = millis();
                        flg_num = 1;
                        flg_ges = 1;
                
                   }    
                }
                   if((d2_x < d1_x && d2_x < d3_x) && (d2_y < d1_y && d2_y < d3_y) && (d2_z < d1_z && d2_z < d3_z) && ((millis() - timestamp_trigger) > 100)){
                    if(d2_x < 2.5 && d2_y < 2.5 && d2_z < 2.5){
                        // console.log('back');
                        timestamp_trigger = millis();
                        flg_num = 1;
                        flg_ges = 2;
                    }
                   }
                   if((d3_x < d1_x && d3_x < d2_x) && (d3_y < d1_y && d3_y < d2_y) && (d3_z < d1_z && d3_z < d2_z) && ((millis() - timestamp_trigger) > 100)){
                    if(d2_x < 3 && d2_y < 3 && d2_z < 3){
                        // console.log('nothing');
                        timestamp_trigger = millis();
                        flg_num = 2;
                        flg_ges = 3;
                    }
                   }
                }

                    if(flg_ges == 1 && flg_num != past_flg_num){
                        console.log("next");
                        if(currentImageIndex === images.length - 1) {
                            currentImageIndex = 0;
                        } else {
                            currentImageIndex++;
                        }
                        slideshowImage.src = images[currentImageIndex];
                    }
                

                    if(flg_ges == 2 && flg_num != past_flg_num){
                        console.log("back");
                        if(currentImageIndex === 0) {
                            currentImageIndex = images.length - 1;
                        } else {
                            currentImageIndex--;
                        }
                        slideshowImage.src = images[currentImageIndex];
                    }

                    if(flg_ges == 3){
                        console.log("nothing");
                    }

                    past_flg_num = flg_num

                if (flg_show_x) {
                    document.querySelector('#input_data').innerHTML += `${gyro.x}, `;
                }

                if (flg_show_y) {
                    document.querySelector('#input_data').innerHTML += `${gyro.y}, `;
                }

                if (flg_show_z) {
                    document.querySelector('#input_data').innerHTML += `${gyro.z}, `;
                }
        }
    }
    

        function keyPressed() {
            if (key == 'x') {
                flg_show_x = !flg_show_x;
            }

            if (key == 'y') {
                flg_show_y = !flg_show_y;
            }

            if (key == 'z') {
                flg_show_z = !flg_show_z;
            }
            
            if (key == 'd') {
                document.querySelector('#input_data').innerText = '';
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

        //ここからスライド関係

        var imageFiles = document.getElementById("image-files");
        var slideshowImage = document.getElementById("slideshow-image");
        var prevButton = document.getElementById("prev-button");
        var nextButton = document.getElementById("next-button");


        var images = [];
        var currentImageIndex = 0;

        imageFiles.addEventListener("change", function(){
            var files = imageFiles.files;
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                var reader = new FileReader();
                reader.onload = (function(file, i) {
                    return function(e) {
                        images[i] = e.target.result;
                        if(currentImageIndex === 0) {
                            slideshowImage.src = images[currentImageIndex];
                        }
                    }
                })(file, i);
                reader.readAsDataURL(file);
            }
        });


        var customUploadButton = document.getElementById("custom-upload-button");
        customUploadButton.addEventListener("click", function () {
            imageFiles.click();
        });

        imageFiles.addEventListener("change", function () {
            for (var i = 0; i < imageFiles.files.length; i++) {
                var file = imageFiles.files[i];
                var reader = new FileReader();
                reader.onload = function (e) {
                    images.push(e.target.result);
                    if (currentImageIndex === 0) {
                        slideshowImage.src = images[currentImageIndex];
                        customUploadButton.style.display = "none";
                        toolkit_placeholder.style.display = "none"
                    }
                }
                reader.readAsDataURL(file);
            }
        });

        imageFiles.addEventListener("change", function () {
            for (var i = 0; i < imageFiles.files.length; i++) {
                var file = imageFiles.files[i];
                var reader = new FileReader();
                reader.onload = function (e) {
                    images.push(e.target.result);
                    if (currentImageIndex === 0) {
                        slideshowImage.src = images[currentImageIndex];
                        customUploadButton.style.display = "none";
                        prevButton.style.display = "block";
                        nextButton.style.display = "block";
                    }
                }
                reader.readAsDataURL(file);
            }
        });



        prevButton.addEventListener("click", function(){
        if(currentImageIndex === 0) {
            currentImageIndex = images.length - 1;
        } else {
            currentImageIndex--;
        }
        slideshowImage.src = images[currentImageIndex];
        });


        nextButton.addEventListener("click", function(){
        if(currentImageIndex === images.length - 1) {
            currentImageIndex = 0;
        } else {
            currentImageIndex++;
        }
        slideshowImage.src = images[currentImageIndex];
        });



