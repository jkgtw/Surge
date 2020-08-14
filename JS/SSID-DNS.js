/*
讓 Surge 根據 SSID 來決定要不要使用你設定的 DoH 伺服器
[General]
doh-server = 你 DoH 伺服器
[Host]
* = script:SSID-DNS
[Script]
SSID-DNS = type=dns,script-path=SSID-DNS.js
*/

if ($network.wifi.ssid === 'SSID1' || $network.wifi.ssid === 'SSID2') {
$done({servers:$network.dns})
} else {
$done({})
}
