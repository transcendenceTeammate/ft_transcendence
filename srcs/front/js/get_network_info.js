/**
 * Script to display the server's IP address and connection information
 * to help users connect from other devices on the same network
 */

document.addEventListener('DOMContentLoaded', function() {
    // Create a network info box if it doesn't already exist
    if (!document.getElementById('network-info')) {
        const infoBox = document.createElement('div');
        infoBox.id = 'network-info';
        infoBox.style.position = 'fixed';
        infoBox.style.bottom = '10px';
        infoBox.style.right = '10px';
        infoBox.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        infoBox.style.color = 'white';
        infoBox.style.padding = '10px';
        infoBox.style.borderRadius = '5px';
        infoBox.style.fontSize = '14px';
        infoBox.style.zIndex = '1000';
        
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Show Network Info';
        toggleButton.style.padding = '5px 10px';
        toggleButton.style.backgroundColor = '#4CAF50';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '3px';
        toggleButton.style.color = 'white';
        toggleButton.style.cursor = 'pointer';
        
        const infoContent = document.createElement('div');
        infoContent.id = 'network-info-content';
        infoContent.style.display = 'none';
        infoContent.style.marginTop = '10px';
        
        infoBox.appendChild(toggleButton);
        infoBox.appendChild(infoContent);
        document.body.appendChild(infoBox);
        
        // Toggle info display when the button is clicked
        toggleButton.addEventListener('click', function() {
            if (infoContent.style.display === 'none') {
                fetchNetworkInfo();
                infoContent.style.display = 'block';
                toggleButton.textContent = 'Hide Network Info';
            } else {
                infoContent.style.display = 'none';
                toggleButton.textContent = 'Show Network Info';
            }
        });
    }
});

/**
 * Fetch network information from the server
 */
function fetchNetworkInfo() {
    const infoContent = document.getElementById('network-info-content');
    
    // Show loading message
    infoContent.innerHTML = 'Loading network information...';
    
    // Get current hostname and port from browser
    const hostname = window.location.hostname;
    const port = window.location.port || '8443';
    const protocol = window.location.protocol;
    
    let html = `
        <div>Connect to this server from other devices on your network:</div>
        <ul style="margin: 5px 0; padding-left: 20px;">
            <li>Current URL: ${protocol}//${hostname}:${port}</li>
        </ul>
        <div>Instructions:</div>
        <ol style="margin: 5px 0; padding-left: 20px;">
            <li>Make sure devices are on the same network</li>
            <li>Create a room on this device</li>
            <li>Share the room code with the other player</li>
            <li>On the other device, open <strong>https://${hostname}:${port}</strong></li>
            <li>Enter the same room code to connect</li>
        </ol>
    `;
    
    infoContent.innerHTML = html;
} 