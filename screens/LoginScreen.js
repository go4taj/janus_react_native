import React,{ useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  TextInput,
  ScrollView,
  View,
  StatusBar,
} from 'react-native';


import { 
  Container,
  Button,
  Text,
} from 'native-base';
import { Colors } from 'react-native/Libraries/NewAppScreen';

const LoginScreen = ({navigation}) => {
  const [username, setUsername] = useState(Math.random().toString(36).substring(2));
  const [roomId, setRoomID] = useState('1234');
  const onLogin = (asParticipant)=>{
    navigation.navigate('Video',{
      janusURL: 'wss://janus.tajahmed.online/janus',
      roomId: roomId,
      username:username,
      isParticipant:asParticipant
     })
  }

  return (
    <>
    <StatusBar barStyle="dark-content" />
      <SafeAreaView>
      <ScrollView horizontal={false} style={styles.scrollview}>
        <Container>
          <View style={styles.container}>
            <Text style={styles.welcome}>
                JANUS VIDEO ROOM
            </Text>
            <Button
                success
                full
                style={[styles.separator,{height:100}]}
                onPress={() => onLogin(false)}
            >
              <Text style={{fontSize:30}}>Go Live</Text>
            </Button>
            <Button
                info
                full
                onPress={() => onLogin(true)}
             style={{height:100}}>
              <Text style={{fontSize:25}}>Join / View Live Stream</Text>
            </Button>
          </View>
        </Container>
      </ScrollView>
    </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.lighter,
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  body: {
    backgroundColor: Colors.white,
  },
  container: {
    flexDirection: 'column',
    height: '100%',
    flex: 1,
    // justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
    // backgroundColor: '#4099ff',
  },
  login: {
    padding: 10,
    backgroundColor: '#4c66a4',
    width: '100%',
    height:100,
    color: '#fff',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#3c56b4'
  },
  input: {
    height: 60,
    borderColor: '#aaa',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    fontSize: 20,
    color: '#000',
    width: '100%',
    backgroundColor: "#fff",
    marginTop: 10   ,
    marginBottom: 10
  },
  welcome: {
    fontSize: 25,
    textAlign: 'center',
    color: Colors.black,
    margin: 10,
    marginBottom:200
  },
  separator: {
    width:'100%',
    marginBottom: 10
  },
  text: {
    color: '#fff'
  }
});

export default LoginScreen;
