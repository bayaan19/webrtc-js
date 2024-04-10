/*
* WebRTC test using WebSocket.
*/

'use strict';

const registerButton = document.getElementById('register-button');
const requestButton = document.getElementById('request-button');
const nextButton = document.getElementById('next-button');
const stopButton = document.getElementById('stop-button');
const remoteVideo01 = document.getElementById('remote-video-01');
const remoteVideo02 = document.getElementById('remote-video-02');

const webSocket = new WebSocket('ws://localhost:8080/websocket-webrtc');

// RTCConfiguration received from server.
let configuration;
// Map of peer connections.
let mapOfPeerConnections = new Map();


webSocket.onopen = () => {
    console.log('-- WebSocket connection established.');
};

webSocket.onmessage = (event) => {
    console.log('-- Message received from WebSocket:', event.data);
    const message = JSON.parse(event.data);

    switch (message.type) {
        case 'CONFIG':
            console.log(`-- Configuration received from server with payload ${message.payload}.`);

            // RTCConfiguration configuration received from server.
            configuration = JSON.parse(message.payload);

            break;
        case 'REQUEST':
            console.log(`-- Request received from ${message.from} with payload ${message.payload}.`);

            // Prepare media tracks from RTSP URLs.
            let stream;
            try {
                let activeRtspUrls = getActiveUrls1(message.payload.split(','));
                stream = getMediaStream1(activeRtspUrls);

                // Send response to server with get-at-able RTSP URLs.
                webSocket.send(JSON.stringify({ to: message.from, type: 'RESPONSE', payload: activeRtspUrls.join(',') }));
            } catch (error) {
                console.error('-- Failed to get media stream:', error);
            }

            // Create peer connection.
            try {
                const remotePeerId = message.from;
                const peerConnection = new WebRTCPeerConnection(configuration, remotePeerId, stream);
                mapOfPeerConnections.set(remotePeerId, peerConnection);
            } catch (error) {
                console.error('-- Failed to create peer connection:', error);
            };

            break;
        case 'RESPONSE':
            console.log(`-- Response received from ${message.from} with payload ${message.payload}.`);

            // Create peer connection.
            try {
                const remotePeerId = message.from;
                const peerConnection = new WebRTCPeerConnection(configuration, remotePeerId);
                mapOfPeerConnections.set(remotePeerId, peerConnection);

                // Enable stop button.
                stopButton.disabled = false;
            } catch (error) {
                console.error('-- Failed to create peer connection:', error);
            }

            break;
        case 'OFFER':
        case 'ANSWER':
            console.log(`-- Offer/Answer received from ${message.from} with payload ${message.payload}.`);

            // Set remote description.
            try {
                const remotePeerId = message.from;
                const peerConnection = mapOfPeerConnections.get(remotePeerId);
                peerConnection.setRemoteDescription(message.payload);
            } catch (error) {
                console.error('-- Failed to set remote description:', error);
            }

            break;
        case 'CANDIDATE':
            console.log(`-- Candidate received from ${message.from} with payload ${message.payload}.`);

            // Add ICE candidate.
            try {
                const remotePeerId = message.from;
                const peerConnection = mapOfPeerConnections.get(remotePeerId);
                peerConnection.addIceCandidate(message.payload);
            } catch (error) {
                console.error('-- Failed to add ICE candidate:', error);
            }

            break;
        default:
            console.error(`-- Unknown message type ${message.type} from ${message.from} with payload ${message.payload}.`);
            break;
    }
};

webSocket.onclose = () => {
    console.log('-- WebSocket connection closed.');

    // Close all peer connections.
    mapOfPeerConnections.forEach((peerConnection) => peerConnection.close());
};

webSocket.onerror = (error) => {
    console.error('-- WebSocket error:', error);
    alert('Unable to connect to server. Please try again later.');
};

class WebRTCPeerConnection {
    constructor(configuration, remotePeerId, stream) {
        this.remotePeerId = remotePeerId;
        this.configuration = configuration;
        this.peerConnection = new RTCPeerConnection(this.configuration);

        if (stream) {
            stream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, stream);
            });
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log(`-- Connection state: ${this.peerConnection.connectionState}`);
        };
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log(`-- ICE connection state: ${this.peerConnection.iceConnectionState}`);
        };
        this.peerConnection.onicegatheringstatechange = (event) => {
            switch (event.target.iceGatheringState) {
                case "gathering":
                    console.log(`-- Collection of ICE candidates has begun.`);
                    break;
                case "new":
                    console.log(`-- New ICE candidate received.`);
                    break;
                case "complete":
                    console.log(`-- Collection of ICE candidates completed.`);
                    break;
            }
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate == null) {
                console.log(`-- There are no more ICE candidates coming during this negotiation.`);
            } else {
                console.log(`-- Sending this ICE candidate (${event.candidate.candidate}) to other peer ${this.remotePeerId}.`);
                webSocket.send(JSON.stringify({ to: this.remotePeerId, type: 'CANDIDATE', payload: event.candidate }));
            }
        };
        this.peerConnection.onicecandidateerror = (event) => {
            console.error(`-- ICE candidate error: ${event.errorCode} - ${event.url} - ${event.errorText}`);
        };

        this.peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            remoteVideo01.srcObject = remoteStream;
        };
    }

    async addIceCandidate(candidate) {
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("-- ICE Candidate added.");
        } catch (error) {
            console.error("-- Failed to add ICE Candidate:", error);
        }
    }

    async setRemoteDescription(offer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            console.log("-- Offer Accepted.");
        } catch (error) {
            console.error("-- Failed to set remote description:", error);
        }
    }

    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            console.log(`-- Sending offer to remote peer ${this.remotePeerId}.`);
            webSocket.send(JSON.stringify({ to: this.remotePeerId, type: 'OFFER', payload: offer }));
        } catch (error) {
            console.error("-- Failed to create or send offer:", error);
        }
    }

    async createAnswer() {
        try {
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log(`-- Sending answer to remote peer ${this.remotePeerId}.`);
            webSocket.send(JSON.stringify({ to: this.remotePeerId, type: 'ANSWER', payload: answer }));
        } catch (error) {
            console.error("-- Failed to create or send answer:", error);
        }
    }

    async close() {
        try {
            this.peerConnection.close();
            console.log("-- Peer connection closed.");
        } catch (error) {
            console.error("-- Failed to close peer connection:", error);
        }
    }
}

function getRtspUrls() {
    // Your code here to return selected RTSP URLs in following format:
    // [{ id: numeric-proxy-id, urls: [rtsp-url-1, rtsp-url-2, ...] }, ...]
    return [{ id: 12345, urls: ["rtsp://admin@password:192.168.1.101:/media/main", "rtsp://admin@password:192.168.1.102:/media/main"] }];
}

function getActiveUrls1(urls) {
    // For testing purposes, return all URLs as active
    return urls;
}
function getActiveUrls(urls) {
    // Your code here to filter and return active RTSP URLs
    return urls.filter(url => isUrlActive(url));
}

function isUrlActive(url) {
    // Your code here to check if the RTSP URL is active
    // You can use any method to check the availability of the URL, such as making a request to it
    // Return true if the URL is active, false otherwise
    // Example implementation using fetch:
    return fetch(url)
        .then(response => response.ok)
        .catch(() => false);
}

async function getMediaStream1(urls) {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
}
function getMediaStream(urls) {
    // Your code here to create and return a MediaStream object from the active RTSP URLs
    // You can use any library or method to handle the RTSP streaming and create the MediaStream object
    // Example implementation using a library like RTSP.js:
    const stream = new MediaStream();
    urls.forEach(url => {
        const player = new RTSP.Player(url);
        player.play();
        const track = player.getTrack();
        stream.addTrack(track);
    });
    return stream;
}




window.onload = async () => {
    requestButton.disabled = false;
}

registerButton.onclick = async () => {
    try {
        registerButton.disabled = true;

        // Send registration request to server.
        webSocket.send(JSON.stringify({ type: 'REGISTER', payload: '12345'}));
    } catch (reason) {
        alert(reason);
    }
};

requestButton.onclick = async () => {
    try {
        requestButton.disabled = true;

        // Get RTSP URLs.
        let rtspUrls = getRtspUrls();

        // Send request to server with RTSP URLs.
        rtspUrls.forEach((elements) => {
            webSocket.send(JSON.stringify({ to: elements.id, type: 'REQUEST', payload: elements.urls.join(',') }));
        });
    } catch (reason) {
        alert(reason);
    }
};

stopButton.onclick = async () => {
    try {
        stopButton.disabled = true;

        // Close all peer connections.
        mapOfPeerConnections.forEach((peerConnection) => peerConnection.close());
    } catch (reason) {
        alert(reason);
    }
}
