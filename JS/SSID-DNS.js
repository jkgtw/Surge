if ($network.wifi.ssid === 'SSID1' || $network.wifi.ssid === 'SSID2') {
$done({servers:$network.dns})
} else {
$done({})
}