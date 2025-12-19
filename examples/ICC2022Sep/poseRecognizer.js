
var poseRecognizer = {
    data: [3.14, 3.14, 3.14, 3.14, 3.14, 3.14, 3.14, 3.14],
    threshold: 0.7,
    is_detecting: false,

    createInputVector: function (landmark_vector) {
        let calc_array = [
            [16, 14, 12],
            [14, 12, 11],
            [12, 11, 13],
            [11, 13, 15],
            [12, 24, 26],
            [11, 23, 25],
            [24, 26, 28],
            [23, 25, 27],
        ];
        let input_array = [];
        for (let c of calc_array) {
            let v1 = createVector(landmark_vector[c[0]].x - landmark_vector[c[1]].x, landmark_vector[c[0]].y - landmark_vector[c[1]].y);
            let v2 = createVector(landmark_vector[c[2]].x - landmark_vector[c[1]].x, landmark_vector[c[2]].y - landmark_vector[c[1]].y);
            input_array.push(abs(v1.angleBetween(v2)));
        }
        return input_array;
    },
    showInputVector: function (landmark_vector) {
        let input_vector = this.createInputVector(landmark_vector);
        let text = `data:[`;
        for (let i = 0; i < input_vector.length - 1; i++) {
            text += `${input_vector[i]},`
        }
        text += `${input_vector[input_vector.length - 1]}],`;
        prompt('1. 下のテキストをコピー\n2. poseRecognizer.js のdata:[...]の行と入れ替える\n3. ページをリロードして認識を確認', text);
    },
    classify: function (input_vector) {
        let distance = 0;
        for (let i = 0; i < input_vector.length; i++) {
            distance += pow(input_vector[i] - this.data[i], 2);
        }
        distance = sqrt(distance);
        if (distance < 0.5) {
            if (this.is_detecting == false) {
                this.timestamp.start_detecting = millis();
            }
            this.is_detecting = true;
            return true;
        }

        if (this.is_detecting == true) {
            this.timestamp.end_detecting = millis();
        }
        this.is_detecting = false;
        return false;
    },
    getContinuesRecognizingTime: function () {
        if (this.is_detecting) {
            return millis() - this.timestamp.start_detecting;
        }
        return 0;
    },
    resetContinuesRecognizingTime: function () {
        this.timestamp.start_detecting = millis();
    },

    timestamp: {
        start_detecting: 0,
        end_detecting: 0,
    }
}