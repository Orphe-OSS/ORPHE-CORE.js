var opts = {
    angle: 0.15, // The span of the gauge arc
    lineWidth: 0.2, // The line thickness
    radiusScale: 1.0, // Relative radius
    pointer: {
        length: 0.59, // // Relative to gauge radius
        strokeWidth: 0.035, // The thickness
        color: '#000000' // Fill color
    },
    limitMax: true,     // If false, max value increases automatically if value > maxValue
    limitMin: true,     // If true, the min value of the gauge will be fixed
    colorStart: '#6FADCF',   // Colors
    colorStop: '#8FC0DA',    // just experiment with them
    strokeColor: '#E0E0E0',  // to see which ones work best for you
    generateGradient: true,
    highDpiSupport: true,     // High resolution support
    // renderTicks is Optional
    renderTicks: {
        divisions: 4,
        divWidth: 1.1,
        divLength: 0.73,
        divColor: '#333333',
        subDivisions: 3,
        subLength: 0.5,
        subWidth: 0.6,
        subColor: '#666666'
    },
    staticZones: [
        { strokeStyle: "#bfbfbf", min: 0, max: 1.0 },
        { strokeStyle: "#45e6e6", min: 1.0, max: 7.0 },
        { strokeStyle: "#ff6040", min: 7.0, max: 10.0 },
    ],
};


const data_today = [
    {
        labels: ['steps/cycle'],
        datasets: [
            {
                label: "Number of Steps or Cycles",
                pointRadius: 1.0,
                data: [0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(255, 159, 64, 0.2)',
                    'rgba(255, 205, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(201, 203, 207, 0.2)'
                ],
                borderColor: [
                    'rgb(255, 99, 132)',
                    'rgb(255, 159, 64)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(54, 162, 235)',
                    'rgb(153, 102, 255)',
                    'rgb(201, 203, 207)'
                ],
                borderWidth: 1
            }
        ]
    },
    {
        labels: ['calories'],
        datasets: [
            {
                label: "Calories",
                pointRadius: 1.0,
                data: [0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(255, 159, 64, 0.2)',
                    'rgba(255, 205, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(153, 102, 255, 0.2)',
                    'rgba(201, 203, 207, 0.2)'
                ],
                borderColor: [
                    'rgb(255, 99, 132)',
                    'rgb(255, 159, 64)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(54, 162, 235)',
                    'rgb(153, 102, 255)',
                    'rgb(201, 203, 207)'
                ],
                borderWidth: 1
            }
        ]
    }
];

const data = [
    {
        labels: [],
        datasets: [
            {
                label: "Acc X",
                backgroundColor: "rgb(255, 96, 64)",
                borderColor: "rgb(255, 96, 64)",
                pointRadius: 1.0,
                data: [],
            },
            {
                label: "Acc Y",
                backgroundColor: "rgb(69,230, 230)",
                borderColor: "rgb(69,230,230)",
                pointRadius: 1.0,
                data: [],
            },
            {
                label: "Acc Z",
                backgroundColor: "rgb(96,255,64)",
                borderColor: "rgb(96,255,64)",
                pointRadius: 1.0,
                data: [],
            },
            {
                label: "composite Acc",
                backgroundColor: "rgb(28,28,28)",
                borderColor: "rgb(28,28,28)",
                pointRadius: 1.0,
                data: [],
            },
            {
                label: "max",
                backgroundColor: "rgb(200,200,200)",
                borderColor: "rgb(200,200,200)",
                pointRadius: 1.0,
                data: [],
            },
        ],
    },
    {
        labels: [],
        datasets: [
            {
                label: "delta Acc X",
                backgroundColor: "rgb(255, 96, 64)",
                borderColor: "rgb(255, 96, 64)",
                pointRadius: 1.0,
                data: [],
            },
            {
                label: "delta Acc Y",
                backgroundColor: "rgb(69,230, 230)",
                borderColor: "rgb(69,230,230)",
                pointRadius: 1.0,
                data: [],
            },
            {
                label: "delta Acc Z",
                backgroundColor: "rgb(96,255,64)",
                borderColor: "rgb(96,255,64)",
                pointRadius: 1.0,
                data: [],
            },
            {
                label: "composite delta Acc",
                backgroundColor: "rgb(28,28,28)",
                borderColor: "rgb(28,28,28)",
                pointRadius: 1.0,
                data: [],
            },
        ],
    },
    {
        labels: [],
        datasets: [
            {
                label: "FFT composite Acc",
                backgroundColor: "rgb(28, 28, 28)",
                borderColor: "rgb(28, 28, 28)",
                pointRadius: 0.0,
                borderWidth: 1.0,
                data: [],
            },
        ],
    },
];

const config = {
    acc: {
        type: "line",
        data: data[0],
        options: {
            animation: false,
            scales: {
                y: {
                    min: -0.5,
                    max: 0.5,
                },
            },
        },
    },
    delta_acc: {
        type: "line",
        data: data[1],
        options: {
            animation: false,
            scales: {
                y: {
                    min: -0.2,
                    max: 0.2,
                },
            },
        },
    },
    fft: {
        type: "line",
        data: data[2],
        options: {
            animation: false,
            scales: {
                y: {
                    min: 0.0,
                    max: 50.0,
                },
            },
        },
    },
    today: {
        steps: {
            type: "bar",
            data: data_today[0],
            options: {
                //animation: false,
                scales: {
                    y: {
                        beginAtZero: true
                    },
                },
            },
        },
        calories: {
            type: "bar",
            data: data_today[1],
            options: {
                //animation: false,
                scales: {
                    y: {
                        beginAtZero: true
                    },
                },
            },
        },
    },
};