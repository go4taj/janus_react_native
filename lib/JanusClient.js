
import WebRTC, {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices
} from 'react-native-webrtc';
import {
  Dimensions
} from 'react-native';
import Janus from './janus';

class JanusClient {

    constructor() {
        this.state = {};
        this.remoteStreams = {};
        this.remoteFeeds = {};
    }

    //connect(url, username, password, roomId, cb) {
    connect(url, roomId,ptype, options) {
        options = options || {};
        this.options = options;
        this.state.url = url;
        this.state.username = options.username || 'anon';
        this.state.password = options.password || '';
        this.state.roomId = roomId;
        this.state.opaqueId = "videoroom-" + Janus.randomString(12);

        this.initWebRTC(options.success,ptype);
    }

    disconnect() {
        if (this.sendStatusInterval) {
          clearInterval(this.sendStatusInterval);
          this.sendStatusInterval = null;
        }
        this.state.localStream.release();
        this.janus.destroy();
    }

    muteAudio(mute) {
      this.state.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !mute;
      });
    }

    muteVideo(mute) {
      this.state.localStream.getVideoTracks().forEach((t) => {
        t.enabled = !mute;
      });
    }

    initWebRTC(cb,ptype) {
        let isFront = true;
        let self = this;
        mediaDevices.enumerateDevices().then(sourceInfos => {
          console.log(sourceInfos);
          let videoSourceId;
          for (let i = 0; i < sourceInfos.length; i++) {
            const sourceInfo = sourceInfos[i];
            if(sourceInfo.kind == "videoinput" && sourceInfo.facing == (isFront ? "front" : "environment")) {
              videoSourceId = sourceInfo.deviceId;
            }
          }
          let constraints = {
            audio: true,
            video: {
              mandatory: {
                minWidth: Dimensions.get('window').width, // Provide your own width, height and frame rate here
                minHeight: 720,
                minFrameRate: 30
              },
              facingMode: (isFront ? "user" : "environment"),
              optional: (videoSourceId ? [{ sourceId: videoSourceId }] : [])
            }
          };
          mediaDevices.getUserMedia(constraints).then(function (stream) {
              self.state.localStream = stream;
              self.initJanus(self.state.url,ptype, cb);
          });
        });
    }

  initJanus(url,ptype, cb) {
    let self = this;
    Janus.init({
      debug: "all",
      callback: () => {
        self.janus = new Janus({
          server: url,
          error:console.log,
          success: () => {
            self.attachVideoRoom(ptype,cb);
          }
        });
      }
    });
  }

  subscribeToFeeds(feeds) {
    let self = this;
    feeds.map(function(feed) {
      self.subscribeFeed(feed);
    });
  }

  subscribeFeed(feed) {
    // A new feed has been published, create a new plugin handle and attach to it as a listener
    var remoteFeed = null;
    let self = this;
    var currentStream = null;
    this.janus.attach(
      {
        plugin: "janus.plugin.videoroom",
        opaqueId: this.state.opaqueId,
        success: function(pluginHandle) {
          remoteFeed = pluginHandle;
          self.remoteFeeds[feed.id] = remoteFeed;
          Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
          Janus.log("  -- This is a subscriber");
          // We wait for the plugin to send us an offer
          var listen = { "request": "join",offer_video:true, "room": self.state.roomId, "ptype": "subscriber", "feed": feed.id };
          remoteFeed.send({"message": listen});
        },
        error: function(error) {
          Janus.error("  -- Error attaching plugin...", error);
        },
        onmessage: function(msg, jsep) {
          Janus.debug(" ::: Got a message (listener) :::");
          Janus.debug(JSON.stringify(msg));
          var event = msg["videoroom"];
          Janus.debug("Event: " + event);
          if(event != undefined && event != null) {
            if(event === "attached") {
              // Subscriber created and attached
              Janus.log("Successfully attached to feed " + remoteFeed.id + " (" + remoteFeed.display + ") in room " + msg["room"]);
            } else if(msg["error"] !== undefined && msg["error"] !== null) {
              Janus.alert(msg["error"]);
            } else {
              // What has just happened?
            }
          }
          if(jsep !== undefined && jsep !== null) {
            Janus.debug("Handling SDP as well...");
            Janus.debug(jsep);
            // Answer and attach
            remoteFeed.createAnswer(
              {
                jsep: jsep,
                media: {
                  audioSend: false,
                  videoSend: false,
                  audioRecv: false,
                  videoRecv: true,
                  data: false
                },	// We want recvonly audio/video
                success: function(jsep) {
                  Janus.debug("Got SDP!");
                  Janus.debug(jsep);
                  var body = { "request": "start", "room": self.state.roomId };
                  remoteFeed.send({"message": body, "jsep": jsep});
                },
                error: function(error) {
                  Janus.error("WebRTC error:", error);
                }
              });
          }
        },
        webrtcState: function(on) {
          Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
        },
        onlocalstream: function(stream) {
          // The subscriber stream is recvonly, we don't expect anything here
        },
        onremotestream: function(stream) {
          Janus.log(" ::: Got a remote stream " + stream.id + " :::");
          currentStream = stream;
          if (self.options.onaddstream) {
            self.options.onaddstream(currentStream);
          }
          self.remoteStreams[feed.id] = currentStream;
        },
        oncleanup: function() {
          Janus.log(" ::: Got a cleanup notification (remote feed " + feed.id + ") :::");
          if (self.options.onremovestream) {
            self.options.onremovestream(currentStream);
          }
          delete self.remoteStreams[feed.id];
          delete self.remoteFeeds[feed.id];
        },
        ondataopen: function() {
        }
      });
  }

  sendStatus() {
    let self = this;
    let content = {
      source: self.videoRoom.id,
      status: {
        id: self.videoRoom.id,
        audioEnabled: true,
        videoEnabled: true,
        speaking: false,
        picture: self.options.picture,
        display: self.state.username,
        // videoType: '360'
        videoType: self.state.useOTG ? '360' : 'normal'
      }
    };
    var text = JSON.stringify({
      type: 'statusUpdate',
      content: content
    });
    self.videoRoom.data({
      text: text,
      error: function(reason) { console.warn(reason); },
      success: function() { console.log("statusUpdate sent"); }
    });
  }

  attachVideoRoom(ptype,cb) {
    let self = this;
    self.janus.attach({
      plugin: "janus.plugin.videoroom",
      stream: self.state.localStream,
      opaqueId: this.state.opaqueId,
      success: function(pluginHandle) {
        console.log("STEP 1 - ATTACHED! (" + pluginHandle.getPlugin() + ", id=" + pluginHandle.getId() + ")");
        self.videoRoom = pluginHandle;
        var register = { "request": "join", "room": self.state.roomId, "ptype": "publisher", "display": self.state.username };
        if(ptype=='subscriber'){
          register = {request:"listparticipants",room:self.state.roomId}
        }
        pluginHandle.send({"message": register,success:(res)=>{self.subscribeToFeeds(res.participants)}});
        if (cb) {
            cb(true);
        }
      },
      error: function(error) {
      },
      consentDialog: function(on) {
        console.log("Consent dialog should be " + (on ? "on" : "off") + " now");
      },
      iceState: function (newState) {
        console.log(" *** ICE STATE: " + newState);
        switch (newState) {
          case 'disconnected':
          case 'failed':
            if (self.options.ondisconnect) {
              self.options.ondisconnect();
            }
            break;

          default:
            break;
        }
      },
      ondataopen: function() {
        console.log("The publisher DataChannel is available");
        //connection.onDataOpen();
        self.sendStatus();
        if (self.sendStatusInterval) {
          clearInterval(self.sendStatusInterval);
        }
        self.sendStatusInterval = setInterval(function() {
          self.sendStatus();
        }, 10000);
      },
      onlocalstream: function(stream) {
        console.log(" ::: Got a local stream :::");
      },
      oncleanup: function () {
        console.log(" ::: Got a cleanup notification: we are unpublished now :::");
      },
      mediaState: function(medium, on) {
        console.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
      },
      webrtcState: function(on) {
        console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
      },
      onremotestream: function(stream) {
        console.log("Remote stream");
      },
      onmessage: function (msg, jsep) {
        var event = msg.videoroom;
        console.log("Event: " + event);

        if (event === "joined") {
          console.log("STEP 2 - JOINED! joined room " + msg.room);

          let media = { audio: true, video: 'hires',data:false }

          self.videoRoom.createOffer({
            stream: self.state.localStream,
            media: media,
            success: function(jsep) {
              console.log("Got publisher SDP!");
              console.log(jsep);
              // that.config = new ConnectionConfig(pluginHandle, cfg, jsep);
              // // Call the provided callback for extra actions
              // if (options.success) { options.success(); }

              var publish = { "request": "configure", "audio": true, "video": true };
              self.videoRoom.send({"message": publish, "jsep": jsep});

            },
            error: function(error) {
              console.log("WebRTC error publishing");
              console.log(error);
              // // Call the provided callback for extra actions
              // if (options.error) { options.error(); }
            }
          });

          // // Step 5. Attach to existing feeds, if any
          if ((msg.publishers instanceof Array) && msg.publishers.length > 0) {
            self.subscribeToFeeds(msg.publishers);
          }
          // The room has been destroyed
        } else if (event === "destroyed") {
          console.log("The room has been destroyed!");
          //$$rootScope.$broadcast('room.destroy');
        } else if (event === "event") {
          // Any new feed to attach to?
          if ((msg.publishers instanceof Array) && msg.publishers.length > 0) {
            self.subscribeToFeeds(msg.publishers);
          // One of the publishers has gone away?
          } else if(msg.leaving !== undefined && msg.leaving !== null) {
            var leaving = msg.leaving;
            //ActionService.destroyFeed(leaving);
          // One of the publishers has unpublished?
          } else if(msg.unpublished !== undefined && msg.unpublished !== null) {
            var unpublished = msg.unpublished;
            //ActionService.destroyFeed(unpublished);
            let stream = self.remoteStreams[unpublished];
            if (stream) {
              if (self.options.onremovestream) {
                self.options.onremovestream(stream);
              }
            }
            delete self.remoteFeeds[unpublished];
            delete self.remoteStreams[unpublished];
          // Reply to a configure request
          } else if (msg.configured) {
            // connection.confirmConfig();
          // The server reported an error
          } else if(msg.error !== undefined && msg.error !== null) {
            console.log("Error message from server" + msg.error);
            // $$rootScope.$broadcast('room.error', msg.error);
          }
        }

        if (jsep !== undefined && jsep !== null) {
          self.videoRoom.handleRemoteJsep({jsep: jsep});
        }
      }
    })
  }
}

const janusClient = new JanusClient();
export default janusClient;