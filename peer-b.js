/*
* WebRTC Test
* Peer B - View video from peer connection.
* Only to receive video from remote peer.
*/

'use strict';

const acceptButton = document.getElementById('accept-button');
const messageButton = document.getElementById('message-button');
const stopButton = document.getElementById('stop-button');
const remoteVideo = document.getElementById('remote-video');
const localSdp = document.getElementById('local-sdp');
const remoteSdp = document.getElementById('remote-sdp');

const iceConfiguration = { iceServers: [{ urls: 'turn:ec2-3-111-37-176.ap-south-1.compute.amazonaws.com:3478', username: 'user1', credential: 'pass1key0' }] }

const peerConnection = new RTCPeerConnection(iceConfiguration);
let dataChannel;

peerConnection.onconnectionstatechange = async () => console.log(`-- Connection state: ${peerConnection.connectionState}`);
peerConnection.oniceconnectionstatechange = async () => console.log(`-- ICE connection state: ${peerConnection.iceConnectionState}`);

peerConnection.onicegatheringstatechange = async (event) => {
    switch (event.target.iceGatheringState) {
        case "gathering":
            /* collection of candidates has begun */
            console.log(`-- Collection of ICE candidates has begun.`);
            break;
        case "new":
            /* new candidate */
            console.log(`-- New ICE candidate received.`);
            break;
        case "complete":
            /* collection of candidates is finished */
            console.log(`-- Collection of ICE candidates completed.`);
            localSdp.value = JSON.stringify(peerConnection.localDescription);
            break;
    }
};
peerConnection.onicecandidate = async (event) => {
    if (event.candidate == null) {
        console.log(`-- There are no more ICE candidates coming during this negotiation.`);
    } else {
        console.log(`-- Send this ICE candidate (${event.candidate.candidate}) to other peer.`);
    }
}
peerConnection.onicecandidateerror = async (event) => console.error(`-- ICE candidate error: ${event.errorCode} - ${event.url} - ${event.errorText}`);

peerConnection.ondatachannel = (data) => {
    dataChannel = data.channel;
    dataChannel.onmessage = (event) => console.log("-- Message received: " + event.data);
    dataChannel.onopen = () => console.log("-- Data channel opened.");
    dataChannel.onclose = () => console.log("-- Data channel closed.");

    messageButton.disabled = false;
}

peerConnection.ontrack = async (event) => {
    const [remoteStream] = event.streams;
    remoteVideo.srcObject = remoteStream;
}

window.onload = async () => {
    remoteSdp.disabled = false;
    acceptButton.disabled = false;
}

acceptButton.onclick = async () => {
    try {
        acceptButton.disabled = true;
        remoteSdp.disabled = true;

        const offer = JSON.parse(remoteSdp.value);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer)).then(() => console.log("-- Offer Accepted."));

        await peerConnection.createAnswer().then((answer) => peerConnection.setLocalDescription(answer)).then(() => console.log("-- Answer created."));

        stopButton.disabled = false;
    } catch (reason) {
        alert(reason);
        console.error(reason);
        acceptButton.disabled = false;
        remoteSdp.disabled = false;
    }
};

messageButton.onclick = async () => {
    try {
        dataChannel.send(`Hello from Peer-B.`)
    } catch (reason) {
        alert(reason);
        console.error(reason);
    }
}

stopButton.onclick = async () => {
    localSdp.value = '';
    remoteSdp.value = '';

    acceptButton.disabled = false;
    messageButton.disabled = true;
    stopButton.disabled = true;

    dataChannel.close();
};