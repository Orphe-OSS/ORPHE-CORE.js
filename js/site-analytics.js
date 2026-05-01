(function () {
  var officialHosts = ['orphe-oss.github.io'];

  if (officialHosts.indexOf(window.location.hostname) === -1) {
    return;
  }

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.dataset.goatcounter = 'https://kikyu.goatcounter.com/count';
  document.head.appendChild(script);
})();
