/**
* (C) 2022 Tetsuaki BABA
*/
window.onload = function () {
  if (window.name != "ORPHE-CORE") {
    let new_win = window.open(document.URL, "ORPHE-CORE", "width=500px");
    document.querySelector('body').hidden = true;
    noLoop();
  }
};