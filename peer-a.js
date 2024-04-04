/*
* WebRTC Test
* Peer A - Send video to peer connection.
* Only to send video to remote peer.
* https://webrtc.org/getting-started/peer-connections
*/

'use strict';

const offerButton = document.getElementById('offer-button');
const answerButton = document.getElementById('answer-button');
const stopButton = document.getElementById('stop-button');
const localSdp = document.getElementById('local-sdp');
const remoteSdp = document.getElementById('remote-sdp');

const iceConfiguration = { iceServers: [{ urls: 'turn:ec2-3-111-37-176.ap-south-1.compute.amazonaws.com:3478', username: 'user1', credential: 'pass1key0' }] }

const peerConnection = new RTCPeerConnection(iceConfiguration);
const dataChannel = peerConnection.createDataChannel('dataChannel');

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
            remoteSdp.disabled = false;
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

dataChannel.onmessage = async (event) => {
    console.log("-- Message Received: " + event.data);
    dataChannel.send(`Hi from Peer-A.`);
}
dataChannel.onopen = () => console.log("-- Data channel opened.");
dataChannel.onclose = () => console.log("-- Data channel closed.");


window.onload = async () => {
    offerButton.disabled = false;
}

offerButton.onclick = async () => {
    try {
        offerButton.disabled = true;

        let stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

        peerConnection.createOffer().then((offer) => peerConnection.setLocalDescription(offer).then(() => console.log("-- Offer created.")));

        answerButton.disabled = false;
    } catch (reason) {
        alert(reason);
        console.error(reason);
        offerButton.disabled = false;
    }
};

answerButton.onclick = async () => {
    try {
        answerButton.disabled = true;
        remoteSdp.disabled = true;

        const answer = JSON.parse(remoteSdp.value);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer)).then(() => console.log("-- Answered."));

        stopButton.disabled = false;
    } catch (reason) {
        alert(reason);
        console.error(reason);
        answerButton.disabled = false;
        remoteSdp.disabled = false;
    }
}

stopButton.onclick = async () => {
    localSdp.value = '';
    remoteSdp.value = '';

    offerButton.disabled = false;
    answerButton.disabled = true;
    stopButton.disabled = true;

    peerConnection.getTracks().forEach((track) => track.stop())
};
