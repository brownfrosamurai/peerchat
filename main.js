const APP_ID = "eef2d20d06d045919a40825ba1322877"

let token = null
let uid = String(Math.floor(Math.random() * 10000))

let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if (!roomId) {
    window.location = 'lobby.html'
}

let localStream
let remoteStream
let peerConnection

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}


const constraints = {
    video: {
        width: { min: 640, ideal: 1920, max: 1920 }, 
        height: { min: 480, ideal: 1080, max: 1080 }, 
    },
    audio: true
}

// Initialize video chat 
const init = async () => {
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({ uid, token })

    // index.html?room=1235321
    // Create new channel 
    channel = client.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleUserJoined)

    channel.on('MemberLeft', handleUserLeft)

    client.on('MessageFromPeer', handleMessageFromPeer)

    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById('user-1').srcObject = localStream

}

// Handle message from peer 
const handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text)

    if (message.type === "offer") {
        createAnswer(MemberId, message.offer)
    }
    if (message.type === "answer") {
        addAnwer(message.answer)
    }
    if (message.type === "candidate") {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate)
        }
    }
}

// Handle new user joining 
const handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:', MemberId)
    createOffer(MemberId)
}

// Handle user leaving 
const handleUserLeft = async () => {
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-2').classList.remove('smallFrame')
}

// Create peer to peer connection
const createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('user-2').style.display = 'block'

    document.getElementById('user-1').classList.add('smallFrame')

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (e) => {
        e.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (e) => {
        if (e.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': e.candidate }) }, MemberId)
        }
    }
}

// Create offer 
const createOffer = async (MemberId) => {
    await createPeerConnection(MemberId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId)
}

const createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId)
}

const addAnwer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(answer)
    }
}

const leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

const toggleCamera = async () => {
    let videoTrack = localStream
        .getTracks()
        .find(track => track.kind === 'video')

    if (videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

const toggleMic = async () => {
    let audioTrack = localStream
        .getTracks()
        .find(track => track.kind === 'audio')

    if (audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

window.addEventListener('beforeunload', leaveChannel)

document.getElementById('camera-btn').addEventListener('click', toggleCamera)

document.getElementById('mic-btn').addEventListener('click', toggleMic)

init()