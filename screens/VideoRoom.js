import React, { Component } from 'react';

import {
    StyleSheet,
    View,
    ScrollView,
    Dimensions,
    NativeModules,
    Animated
} from 'react-native';
import JanusClient from '../lib/JanusClient'
import { Text,Icon,Overlay } from 'react-native-elements'
import Spinner from 'react-native-loading-spinner-overlay';
import InCallManager from 'react-native-incall-manager';

const {WebRTCModule} = NativeModules;
import WebRTC, {
  RTCView,
} from 'react-native-webrtc';

class VideoRoomScreen extends Component {
    setStream(stream,reset){
      let myStreams = this.state.stream;
      if(reset){
        delete myStreams[stream]
      } else myStreams[stream.toURL()] = stream.toURL();
      this.setState({stream:myStreams});
    }

    constructor(props) {
        super(props);
        this.liked = false;
        this.state = {
          muteVideo: false,
          muteAudio: false,
          visible:true,
          stream:{}
        };
        this.setStream = this.setStream;
        let self = this;

        // let state = this.props.getState();
        let params = this.props.route.params;
        console.log(params);
        JanusClient.connect(params.janusURL,
           parseInt(params.roomId),
           params.isParticipant?'subscriber':'publisher',
        { username: params.username,
          success: () => {
            if(params.isParticipant){
              self.setState({visible:false});
            }else {
              console.log('done',JanusClient.state.localStream.toURL());
              self.setState({
                visible:false,
                selfViewSrc: JanusClient.state.localStream.toURL()
              });
            }
          },
          onaddstream: (stream) => {
            this.setStream(stream)
          },
          onremovestream: (stream) => this.setStream(stream,true),
          ondisconnect: () => {
            this.onLogout();
          }
        });
        this.animatedValue = new Animated.Value(0);
    }

    renderOverlay = () => {
      const imageStyles = [
        styles.overlayHeart,
        {
          opacity: this.animatedValue,
          transform: [
            {
              scale: this.animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1.5],
              }),
            },
          ],
        },
      ];
  
      return (
        <View style={styles.overlay}>
          <Animated.Image
            source={require('../img/heart.png')}
            style={imageStyles}
          />
        </View>
      );
    }

    componentDidMount() {
      InCallManager.start({ media: 'audio' });
      // WebRTCModule.startAudioManager();
      // KeepAwake.activate();
    }

    componentWillUnmount() {
        // WebRTCModule.stopAudioManager();
        // KeepAwake.deactivate();
    }

    onLogout() {
        JanusClient.disconnect();
    }

    toggleAudio() {
      this.setState({audioMute: !this.state.audioMute});
      JanusClient.muteAudio(!this.state.audioMute);
    }

    toggleVideo() {
      this.setState({videoMute: !this.state.videoMute});
      JanusClient.muteVideo(!this.state.videoMute);
    }

    toggleSpeaker(){
      if(this.state.speakerOn){
        this.setState({speakerOn: false});
        InCallManager.setForceSpeakerphoneOn(false)
      }else{
        this.setState({speakerOn: true});
        InCallManager.setForceSpeakerphoneOn(true)
      }
    }

    endCall(){
      this.onLogout();
      this.props.navigation.goBack();
    }

    toggleLike = () => {
      this.liked = !this.liked;
      Animated.sequence([
        Animated.spring(this.animatedValue, { toValue: 1, useNativeDriver: false }),
        Animated.spring(this.animatedValue, { toValue: 0, userNativeDriver: false }),
      ]).start();
}

    render() {
        return (
          <>
          <ScrollView>
          <View style={{flex: 1, flexDirection: 'row'}}>
            { !this.state.audioMute ? 
              <Icon
                raised
                name='mic'
                type='FontAwesome'
                color='grey'
                onPress={() => this.toggleAudio()} /> : 
              <Icon
                raised
                name='mic-off'
                type='Feather'
                color='black'
                onPress={() => this.toggleAudio()} /> }
            { this.state.videoMute ? 
              <Icon
                raised
                name='videocam-off'
                type='Feather'
                color='grey'
                onPress={() => this.toggleVideo()} /> : 
              <Icon
                raised
                name='videocam'
                type='Feather'
                color='black'
                onPress={() => this.toggleVideo()} /> }

            { this.state.speakerOn ? 
              <Icon
                raised
                name='volume-up'
                type='FontAwesome'
                color='black'
                onPress={() => this.toggleSpeaker()} /> : 
              <Icon
                  raised
                  name='volume-down'
                  type='FontAwesome'
                  color='black'
                  onPress={() => this.toggleSpeaker()} /> }

            <Icon
              raised
              name='call-end'
              type='SimpleLineIcons'
              color='red'
              onPress={() => this.endCall()} />
            <Icon
              raised
              name='thumb-up'
              type='AntDesign'
              color='lightblue'
              onPress={() => this.toggleLike()} />
          </View>
          <View style={styles.container}>
              { this.state.selfViewSrc && <RTCView key={this.state.selfViewSrcKey} streamURL={this.state.selfViewSrc} style={styles.selfView}/>}
              {this.state.stream && Object.keys(this.state.stream).map((key, index) => {
                  return <RTCView key={Math.floor(Math.random() * 1000)} streamURL={this.state.stream[key]} style={styles.remoteView}/>
              })
              }
          </View>
          <View style={{ flex: 1 }}>
            <Spinner visible={this.state.visible} textContent={"Connecting..."} textStyle={{textAlign:'center',width:"100%",color: '#FFF'}} />
          </View>
        </ScrollView>
        {this.renderOverlay()}
        </>
        )
    }
}

const styles = StyleSheet.create({
  selfView: {
    width: Dimensions.get('window').width,
    height: 300,
  },
  remoteView: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height/2.35
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  listViewContainer: {
    height: 150,
  },
  overlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    height:100,
    left: 0,
    right: 0,
    top: Dimensions.get('window').height/2.5,
    bottom: 0,
  },
  overlayHeart: {
    zIndex:1,
    tintColor: 'red',
  }
});

export default VideoRoomScreen;