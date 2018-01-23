/*
 * Written by Bekcpear
 *
 * */

(function() {
'use strict';

var weechat = angular.module('weechat');

weechat.factory('htmlHandler', ['$rootScope', '$timeout', 'utils', function($rootScope, $timeout, utils) {

  var spreElem = undefined;
  var spreElem_height_px_last = "";

  var jumpToStat   = 1;
  var jumpToTimers = []; // list the timers (sorted by priority)
  // pri
  //   -> buttons
  //     -> visibility
  //       -> timers
  //         -> timer
  //         -> expire
  var readmarkerAttr = [];
  // [0] -> flash action timer promise
  // [1] -> showAndFlash :: waiting showing timer

  var resetInput = function(uuidOnly, isiOS) {

    // reset imgur-upload-uuid
    document.getElementById("imgur-upload-uuid").style.display = "none";
    document.getElementById("imgur-upload-uuid").style.top     = "initial";
    document.getElementById("imgur-upload-uuid").style.bottom  = "initial";
    document.getElementById("imgur-upload-uuid").textContent = "";

    if ( ! uuidOnly ) {
      // reset inputbar
      document.getElementById("sendMessage-pre").textContent = "";
      if (utils.isMobileUi()) {
      document.getElementById("bufferlines").style.marginBottom = "34px";
      document.getElementById("bufferlines").style.height = "calc(100% - 94px)";
      } else {
      document.getElementById("bufferlines").style.marginBottom = "94px";
      document.getElementById("bufferlines").style.height = "calc(100% - 154px)";
      }

      document.getElementById("msgSegmentedNoti").style.display = "none";

      if (isiOS) {
      document.getElementById("sendMessage").style.height = "34px";
      }

      spreElem_height_px_last = "";
    }

  };

  // judge if the message will be sent in segments
  var msgSegNotify = function(command, normalInput) {

    var noinput = true;
    var cmd_msgSegmented = false;
    if ( command !== undefined && command !== "") {
      noinput = false;

      if (command.match(/.+[\r\n]+.+/)) {
        document.getElementById("msgSegmentedNoti").textContent = "Message will be sent in segments. (including line-feed or carriage return)";
        cmd_msgSegmented = true;
      } else {
        var cmd_length = 0;
        var cmd_array = command.match(/[-_.!~*'()a-z0-9]/gi);
        if (cmd_array) {
          cmd_length += cmd_array.length;
        }
        var cmd_ext_array = encodeURIComponent(command).match(/%[a-f0-9]{2}/gi);
        if (cmd_ext_array) {
          cmd_length += cmd_ext_array.length;
        }
        if (cmd_length > 412) {
          document.getElementById("msgSegmentedNoti").textContent = "Message will be sent in segments. (size limit according to weechat default settings)";
          cmd_msgSegmented = true;
        } else {
          document.getElementById("msgSegmentedNoti").style.display = "none";
        }
      }
      if ( cmd_msgSegmented ) {
        document.getElementById("msgSegmentedNoti").style.display = "block";
      }
    } else {
      noinput = true;
      document.getElementById("msgSegmentedNoti").style.display = "none";
    }

    if ( ! normalInput ) noinput = true;
    return [noinput, cmd_msgSegmented];

  };

  // judge if uploaded image url exists
  var adjUuidSegBar = function(cmd_msgSegmented, command) {

    if ( ! command.match(/fars.ee\/[-_.!~*'()a-z0-9]{4}\.[a-z]{3,4}/i) ) {
      this.resetInput(true);
    } else if ( document.getElementById("imgur-upload-uuid").style.display === "block" && utils.isMobileUi() ) {
      if ( cmd_msgSegmented ) {
        document.getElementById("imgur-upload-uuid").style.bottom = "calc(100% + 20px)";
      } else {
        document.getElementById("imgur-upload-uuid").style.bottom = "100%";
      }
    }

  };

  // add uuid of uploaded image
  var addImgUuid = function(imageUuid, imageUrl) {

    var imgUuidHistElem = document.getElementById("imgur-upload-uuid-hist");
    var imgUuidElem = document.getElementById("imgur-upload-uuid");
    if ( imageUuid !== undefined && imageUuid !== '' ) {
      if ( utils.isMobileUi() ) {
          imgUuidElem.style.top    = "initial";
          imgUuidElem.style.bottom = "100%";
      } else {
          imgUuidElem.style.top    = "100%";
          imgUuidElem.style.bottom = "initial";
      }
      if ( imgUuidElem.textContent !== "" ) {
        imgUuidElem.textContent += ", " + imageUuid;
      } else {
        imgUuidElem.textContent = imageUuid;
      }
      imgUuidHistElem.textContent += "url: " + imageUrl + ", uuid: " + imageUuid + "\n";
      imgUuidElem.style.display = "block";
    } else {
      if ( imgUuidElem.textContent !== '' ) {
        imgUuidElem.textContent += ", <no-uuid>";
      }
      imgUuidHistElem.textContent += "url: " + imageUrl + ", uuid: <image already exists before upload, so cannot get uuid>\n";
    }

  };

  // adjust inputbar height
  var adjInpBar = function(command, isiOS) {
    if (spreElem === undefined) spreElem = document.getElementById("sendMessage-pre");
    spreElem.textContent = command;
    var spreElem_height_px = window.getComputedStyle(spreElem,null).getPropertyValue("height");

    if (spreElem_height_px !== spreElem_height_px_last) {
        if (utils.isMobileUi()) {
            var bufLinElemPB = parseInt(spreElem_height_px);
        } else {
            var bufLinElemPB = parseInt(spreElem_height_px) + 60;
        }
        document.getElementById("bufferlines").style.marginBottom = bufLinElemPB.toString() + "px";
        document.getElementById("bufferlines").style.height = "calc(100% - " + bufLinElemPB.toString() + "px - 60px)";
    }

    if (isiOS) {
        if (utils.isMobileUi()) {
          spreElem.style.paddingRight = "137px";
        } else {
          spreElem.style.paddingRight = "100px";
        }
        document.getElementById("sendMessage").style.height = spreElem_height_px;
        document.getElementById("sendMessage").style.width = window.getComputedStyle(spreElem,null).getPropertyValue("width");
        document.getElementById("sendMessage").style.minWidth = window.getComputedStyle(spreElem,null).getPropertyValue("width");
    }
    spreElem_height_px_last = spreElem_height_px;
  };

  // toggle jumpTo buttons
  var toggleJumpTo = function(button, stat, visibility, transition, wait, pri, transitionTime) {
    // For toMention & toReadmarker
    // stat: 1 -> default
    //       2 -> always visibile
    //       3 -> always hidden
    //       4 -> keep last stat
    //       5 -> same as 4, but has a high priority
    // For toBottom
    // stat: 1 -> show
    //       0 -> hidden
    //
    // [pri] will not effect when [stat] is greater then 3
    // if transitionTime has a value 0.71, this means current action is only for stat 2
    
    if ( ! Number.isInteger(pri) || pri < 0 ) pri = 0;
    if ( transition === undefined  ) transition = false; 
    if ( wait === undefined ) wait = transition;

    var jumpTo = document.querySelectorAll(".jumpTo");
    var jumpToMask = document.querySelectorAll(".jumpTo-mask");
    if ( document.getElementById("nicklist") ) {
      var jTright = "160px";
      var jTMright = "150px";
    } else {
      var jTright = "20px";
      var jTMright = "10px";
    }
    if ( jumpTo && jumpTo[0] ) {
      for (var i = 0; i < jumpTo.length; ++i ) {
        jumpTo[i].style.right = jTright;
      }
    }
    if ( jumpToMask && jumpToMask[0] ) {
      for (var i = 0; i < jumpToMask.length; ++i ) {
        jumpToMask[i].style.right = jTMright;
      }
    }


    var addTimers = function(button, visibility, timers, pri) {
      // button: 
      //    0 --> toMention
      //    1 --> toReadmarker
      //    2 --> toBottom
      var added = false;

      if ( visibility ) visibility = 1;
      else visibility = 0;

      for (var i = 0; i <= pri; ++i) {
        if ( ! jumpToTimers[i] ) {
          jumpToTimers[i] = [];
        }
        if ( i === pri ) {
          for (var j = 0; j <= button; ++j) {
            if ( ! jumpToTimers[pri][j] ) {
              jumpToTimers[pri][j] = [];
            }
            if ( j === button ) {
              if ( ! jumpToTimers[pri][button][0] && visibility !== 0 ) {
                jumpToTimers[pri][button][0] = [];
              }
              jumpToTimers[pri][button][visibility] = timers;
              added = true;
            }
          }
        }
      }
      if ( !added ) {
        console.log("!! -- add timers error: ");
        console.log(timers);
        console.log(JSON.parse(JSON.stringify(jumpToTimers)));
      }
      return added;
    };

    var cleanOldTimers = function(button, visibility, pri){
      // button: 
      //    0 --> toMention
      //    1 --> toReadmarker
      //    2 --> toBottom
      var cleaned = true;

      if ( visibility ) visibility = 1;
      else visibility = 0;

      for (var i = 0; i < jumpToTimers.length; i++) {
        if ( jumpToTimers[i][button] && jumpToTimers[i][button].length > 0 && jumpToTimers[i][button][visibility] && jumpToTimers[i][button][visibility].length > 0 ) {
          var timers = jumpToTimers[i][button][visibility];
          var timers_len = timers.length;
          var j = 0;
          while ( j < timers_len ) {
            cleaned = false;
            if ( pri >= i || timers[j].expire < Date.now() ) {
              $timeout.cancel(timers[j].timer);
              for (var k = j; k < timers.length - 1; ++k) {
                jumpToTimers[i][button][visibility][k] = timers[k + 1];
              }
              jumpToTimers[i][button][visibility].pop();
              timers_len--;
              cleaned = true;
            } else {
              j++;
            }
          }
        }
      }
      return cleaned;
    };

    if ( button !== "toBottom" ) {

      var toReadmarker = document.getElementById("jumpToReadmarker");
      var toMention = document.getElementById("jumpToLastMention");

      if ( button ) {

        if ( stat >= 4) {
          if ( jumpToStat === 2 ) {
            pri = stat - 4;
            switch ( visibility ) {
              case true:
                toggleJumpTo(button, 2, false, false, false, pri);
                toggleJumpTo(button, 2, true, transition, false, pri, transitionTime);
                break;
              case false:
                toggleJumpTo(button, 2, true, false, false, pri);
                toggleJumpTo(button, 2, false, transition, false, pri, transitionTime);
                break;
            }
          } else if ( jumpToStat === 1 && transitionTime !== 0.71 ) {
            pri = stat - 4;
            switch ( visibility ) {
              case true:
                toggleJumpTo(button, 1, false, false, false, pri);
                toggleJumpTo(button, 1, true, false, false, pri);
                toggleJumpTo(button, 1, false, true, true, pri);
                break;
              case false:
                toggleJumpTo(button, 1, true, false, false, pri);
                toggleJumpTo(button, 1, false, transition, false, pri);
                break;
            }
          } else {
            return false;
          }
        }

        var getEle = function(btn) {
          if (btn === "toReadmarker") {
            return toReadmarker;
          } else if (btn === "toMention") {
            return toMention;
          }
        };

        var togJumpTo = function(btn, duration, visibility, stage) {
          /* stage:
           *  0 -> transition first stage
           *  1 -> transition second stage
           * */
          switch (visibility) {
            case true:
              switch (stage) {
                case 0:
                  getEle(btn).style.color = "transparent";
                  getEle(btn).style.backgroundColor = "transparent";
                  getEle(btn).style.transitionDuration = duration;
                  getEle(btn).style.display = "block";
                  break;
                case 1:
                  getEle(btn).style.color = "";
                  getEle(btn).style.backgroundColor = "";
                  break;
              }
              break;
            case false:
              switch (stage) {
                case 0:
                  getEle(btn).style.transitionDuration = duration;
                  getEle(btn).style.color = "transparent";
                  getEle(btn).style.backgroundColor = "transparent";
                  break;
                case 1:
                  getEle(btn).style.display = "none";
                  break;
              }
              break;
          }
        };

        if ( transition && wait ) {
          var duration = "";
          // to the default 10s setted in css file
          var durationForTimer_1 = 15000;
          var durationForTimer_2 = 25000;
        } else if ( !transition && !wait ) {
          var duration = "0s";
          var durationForTimer_1 = 0;
          var durationForTimer_2 = 0;
        } else if ( transition && !wait) {
          if ( typeof(transitionTime) !== "number" || transitionTime < 0 ) transitionTime = 1;
          var duration = transitionTime.toString() + "s";
          var durationForTimer_1 = 0;
          var durationForTimer_2 = visibility ? 0 : transitionTime * 1000;
        }
        switch (button) {
          case "toMention":
            if (cleanOldTimers(0, visibility, pri)) {
              var tmp_timers = [
                {
                  timer: $timeout(function(){togJumpTo(button, duration, visibility, 0);}, durationForTimer_1),
                  expire: Date.now() + durationForTimer_1
                },
                {
                  timer: $timeout(function(){togJumpTo(button, duration, visibility, 1);}, durationForTimer_2),
                  expire: Date.now() + durationForTimer_2
                }
              ];
              addTimers(0, visibility, tmp_timers, pri);
            }
            break;
          case "toReadmarker":
            if (cleanOldTimers(1, visibility, pri)) {
              var tmp_timers = [
                {
                  timer: $timeout(function(){togJumpTo(button, duration, visibility, 0);}, durationForTimer_1),
                  expire: Date.now() + durationForTimer_1
                },
                {
                  timer: $timeout(function(){togJumpTo(button, duration, visibility, 1);}, durationForTimer_2),
                  expire: Date.now() + durationForTimer_2
                }
              ];
              addTimers(1, visibility, tmp_timers, pri);
            }
            break;
        }
      } else {
        jumpToStat = stat;
        cleanOldTimers(0, true, 99);
        cleanOldTimers(0, false, 99);
        cleanOldTimers(1, true, 99);
        cleanOldTimers(1, false, 99);
        switch(stat) {
          case 1:
            toggleJumpTo("toMention", 1, true, false);
            toggleJumpTo("toMention", 1, false, true);
            toggleJumpTo("toReadmarker", 1, true, false);
            toggleJumpTo("toReadmarker", 1, false, true);
            break;
          case 2:
            toggleJumpTo("toMention", 1, true, false);
            toggleJumpTo("toReadmarker", 1, true, false);
            break;
          case 3:
            if ( cleanOldTimers(0, 1, 99) && cleanOldTimers(1, 1, 99)  ) {
              toReadmarker.style.display = "none";
              toMention.style.display = "none";
            }
            break;
          default:
        }
      }
    } else if ( button === "toBottom" ) {
      var toBottomElem = document.getElementById("jumpToBottom");
      switch(stat) {
        case 1:
          if ( cleanOldTimers(2, 1, 0) ) {
            toBottomElem.style.color = "transparent";
            toBottomElem.style.backgroundColor = "transparent";
            toBottomElem.style.display = "block";
            var tmp_timers = [
              {
                timer: $timeout(function(){
                  toBottomElem.style.color = "";
                  toBottomElem.style.backgroundColor = "";
                }, 0),
                expire: Date.now()
              }
            ];
            addTimers(2, true, tmp_timers, 0)
          }
          break;
        case 0:
          if ( cleanOldTimers(2, 0, 0) ) {
            toBottomElem.style.color = "transparent";
            toBottomElem.style.backgroundColor = "transparent";
            var tmp_timers = [
              {
                timer: $timeout(function(){toBottomElem.style.display = "none";}, 300),
                expire: Date.now() + 300
              }
            ];
            addTimers(2, false, tmp_timers, 0)
          }
          break;
        default:
      }
    }

  };

  var handleReadmarker = function(action) {

    if ( document.querySelectorAll('.readmarker').length > 0 ) {
      var readmarker = document.querySelectorAll('.readmarker')[document.querySelectorAll('.readmarker').length - 1];
    }

    if (! readmarker && action !== "refresh") return false;

    switch (action) {
      case "hide":
        var hideLag = 500;
        if ( readmarker !== undefined ) {
          readmarker.style.transitionProperty = '';
          readmarker.style.transitionDuration = hideLag / 1000 + 's';
          readmarker.style.height = '0';
        }
        return hideLag;
      case "show":
        var flashLag = 500;
        if (parseInt(window.getComputedStyle(readmarker, null).getPropertyValue("height")) !== 20) {
          readmarker.style.transitionProperty = '';
          readmarker.style.transitionDuration = flashLag / 1000 + 's';
          readmarker.style.height = '20px';
        }
        return flashLag;
      case "showAndFlash":
        var flashLag = handleReadmarker("show");
        $timeout.cancel(readmarkerAttr[1]);
        readmarkerAttr[1] = $timeout(function() {
          if (window.getComputedStyle(readmarker, null).getPropertyValue("background-color") !== "rgb(187, 184, 215)" 
           && window.getComputedStyle(readmarker, null).getPropertyValue("background-color") !== "rgba(187, 184, 215, 1)") {
            readmarker.style.transitionProperty = 'background-color';
            readmarker.style.transitionDuration = '0.1s';
            readmarker.style.backgroundColor = 'rgba(187, 184, 215, 1)';
            $timeout.cancel(readmarkerAttr[0]);
            readmarkerAttr[0] = $timeout(function() {
              readmarker.style.transitionProperty = 'background-color';
              readmarker.style.transitionDuration = '0.5s';
              readmarker.style.backgroundColor = 'rgba(0, 0, 0, 0)';
            }, 500);
          }
          if ($rootScope.bufferBottom) {
            document.getElementById("end-of-buffer").scrollIntoView();
          }
        }, flashLag);
        break;
      default:
        console.log("handle readmarker error: invalid action: " + action);
    }

  };

  return {
    resetInput: resetInput,
    msgSegNotify: msgSegNotify,
    adjUuidSegBar: adjUuidSegBar,
    addImgUuid: addImgUuid,
    adjInpBar: adjInpBar,
    toggleJumpTo: toggleJumpTo,
    handleReadmarker: handleReadmarker
  };

}]);
})();
