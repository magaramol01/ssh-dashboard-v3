we gonna name update dashboard page frist remove the dummy data 

for dropdown vessel seection drop on the page curl --url 'https://smartshipweb.com/prod/api/v1/getShipBySisterGroup' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json;charset=UTF-8' \
  -b '_ga=GA1.1.232788462.1771339319; _clck=fm4v8n%5E2%5Eg9c%5E0%5E2324; _ga_PMRD0H9NRQ=GS2.1.s1789017758$o16$g1$t1789018169$j59$l0$h0' \
  -H 'origin: https://www.smartshipweb.com' \
  -H 'pragma: no-cache' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.smartshipweb.com/' \
  -H 'sec-ch-ua: "Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36' \
  -H 'x-auth-id: eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJzTHpEd2NjN3AxSUszWWxkb0ZCN3puek50QWg0R00tcDJqX3VYajhJSWNjIn0.eyJleHAiOjE3ODg4Mzc4MTYsImlhdCI6MTc4ODgwMTgxNiwianRpIjoiMTQ2YjczMjgtZGM2Ni00NmZkLTg4NmYtM2YzNTcyZWIzOWYwIiwiaXNzIjoiaHR0cHM6Ly9zbWFydHNoaXB3ZWIuY29tL2tleWNsb2FrLXByb2QvYXV0aC9yZWFsbXMvb3Jpb24iLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiNzE5NmQ1ZTMtM2ZmOC00ODgzLTk2NzgtNTFjY2U0NWYyZGJjIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiQWdncmVnYXRlX1NlcnZpY2UiLCJzaWQiOiI5MzUwZmM2ZS1kODBmLTQ2MWEtODY1YS0xNTEzOGI5MzY0MzAiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbIioiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbImRlZmF1bHQtcm9sZXMtb3Jpb24iLCJvZmZsaW5lX2FjY2VzcyIsInVtYV9hdXRob3JpemF0aW9uIiwiU21hcnQgU2hpcCBTdXBlciBVc2VyIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJwcm9maWxlIGVtYWlsIiwibXNnIjoiVXNlciBMb2dpbiBTdWNjZXNzIiwiVXNlck5hbWUiOiJBbW9sIE1hZ2FyIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIkVtYWlsIjoiYS5tYWdhckBzbWFydHNoaXBodWIuY29tIiwiRmlyc3ROYW1lIjoiQW1vbCIsIlNjcmVlbk1hcHBpbmciOiJbXCJBbGxcIl0iLCJpc3ZhbGlkIjoidHJ1ZSIsInByZWZlcnJlZF91c2VybmFtZSI6ImEubWFnYXJAc21hcnRzaGlwaHViLmNvbSIsIkRvd25sb2FkVEFSZXBvcnRzIjoiZmFsc2UiLCJSb2xlIjoiU21hcnQgU2hpcCBTdXBlciBVc2VyIiwiQ29tcGFueU5hbWUiOiJzbWFydHNoaXBodWIiLCJNb2JpbGVOdW1iZXIiOiIxMjM0NTY3ODkxIiwia2V5Y2xvYWtpZCI6IjcxOTZkNWUzLTNmZjgtNDg4My05Njc4LTUxY2NlNDVmMmRiYyIsIkRlZmF1bHRTY3JlZW5NYXBwaW5nIjoiW1wiRGFzaGJvYXJkSG9tZVwiXSIsIkNyZWF0ZVNoaXBzIjoidHJ1ZSIsImlkIjoiMTIyIiwiQ3JlYXRlUnVsZXMiOiJ0cnVlIiwiZWRpdFJ1bGVzIjoidHJ1ZSIsImVtYWlsIjoiYS5tYWdhckBzbWFydHNoaXBodWIuY29tIiwiRGVsZXRlVEFSZXBvcnRzIjoiZmFsc2UiLCJ1c2VybmFtZSI6ImEubWFnYXJAc21hcnRzaGlwaHViLmNvbSJ9.ttvVbbsE6XpmgT6hogwltx9R1KItlQwEwSl82P33_oymJP_29JYoSb1U6bgQBAUQkBHRhcEp21vFcZ2cANScxDT-6aDDsHsK5YEJ_nr7h4EgLa9kBcEazQT53FKjxJyFJ_VxqJ9fyD1qerJeMlNQh9g9jaBl5c2pu4L4Kie56IaTBE_Kilyiyi2PqsyUbHeQUVhIj44RDJAUuGeP9GcZAhHFEldygFACybqMAWuEJH9Pk0gnGyxENfoVIHN7UUs4YLGQc7Q95N8lMBJp_OIQFp4-nHHqrU0DywT0g9swaKHV5Iryc6NA3jGqprkw6z9HGkv8lOHjXcPccLFP7ynQfw' \
  -H 'x-refresh-id: eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJmZjQ0YTYwNC03Mzk0LTQ2ZDMtYjBlMC0yMWE1ZTY4MmQzNmYifQ.eyJleHAiOjE3ODg4MDM2MTYsImlhdCI6MTc4ODgwMTgxNiwianRpIjoiMWYyYTc5YzMtY2E5MC00YjQ3LTk4YmQtYTkwYWRlOGU3NDI4IiwiaXNzIjoiaHR0cHM6Ly9zbWFydHNoaXB3ZWIuY29tL2tleWNsb2FrLXByb2QvYXV0aC9yZWFsbXMvb3Jpb24iLCJhdWQiOiJodHRwczovL3NtYXJ0c2hpcHdlYi5jb20va2V5Y2xvYWstcHJvZC9hdXRoL3JlYWxtcy9vcmlvbiIsInN1YiI6IjcxOTZkNWUzLTNmZjgtNDg4My05Njc4LTUxY2NlNDVmMmRiYyIsInR5cCI6IlJlZnJlc2giLCJhenAiOiJBZ2dyZWdhdGVfU2VydmljZSIsInNpZCI6IjkzNTBmYzZlLWQ4MGYtNDYxYS04NjVhLTE1MTM4YjkzNjQzMCIsInNjb3BlIjoicm9sZXMgYWNyIHdlYi1vcmlnaW5zIHByb2ZpbGUgYmFzaWMgZW1haWwifQ.bpp93glSq9uxVIH40e8eWk4LwhjwKX0VEG2eoMTppDEvBO-DTNV7aaU3x2Dw8doVktDvB4sFqw6367w0Sb_6MA' \
  -H 'x-request-id: 7028bbfb-01fd-4a1b-9a6b-b5a1e4755fa1' \
  -H 'x-tenant-id: orion' \
  --data-raw '{"id":"Select All"}'



for map which we gonaan show  use goona use this api 


curl --url 'https://smartshipweb.com/prod/api/v1/getWindyMapGeoJson?vesselId=28' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'cache-control: no-cache' \
  -b '_ga=GA1.1.232788462.1771339319; _clck=fm4v8n%5E2%5Eg9c%5E0%5E2324; _ga_PMRD0H9NRQ=GS2.1.s1789017758$o16$g1$t1789018169$j59$l0$h0' \
  -H 'origin: https://www.smartshipweb.com' \
  -H 'pragma: no-cache' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.smartshipweb.com/' \
  -H 'sec-ch-ua: "Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36' \
  -H 'x-auth-id: eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJzTHpEd2NjN3AxSUszWWxkb0ZCN3puek50QWg0R00tcDJqX3VYajhJSWNjIn0.eyJleHAiOjE3ODg4Mzc4MTYsImlhdCI6MTc4ODgwMTgxNiwianRpIjoiMTQ2YjczMjgtZGM2Ni00NmZkLTg4NmYtM2YzNTcyZWIzOWYwIiwiaXNzIjoiaHR0cHM6Ly9zbWFydHNoaXB3ZWIuY29tL2tleWNsb2FrLXByb2QvYXV0aC9yZWFsbXMvb3Jpb24iLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiNzE5NmQ1ZTMtM2ZmOC00ODgzLTk2NzgtNTFjY2U0NWYyZGJjIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiQWdncmVnYXRlX1NlcnZpY2UiLCJzaWQiOiI5MzUwZmM2ZS1kODBmLTQ2MWEtODY1YS0xNTEzOGI5MzY0MzAiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbIioiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbImRlZmF1bHQtcm9sZXMtb3Jpb24iLCJvZmZsaW5lX2FjY2VzcyIsInVtYV9hdXRob3JpemF0aW9uIiwiU21hcnQgU2hpcCBTdXBlciBVc2VyIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJwcm9maWxlIGVtYWlsIiwibXNnIjoiVXNlciBMb2dpbiBTdWNjZXNzIiwiVXNlck5hbWUiOiJBbW9sIE1hZ2FyIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIkVtYWlsIjoiYS5tYWdhckBzbWFydHNoaXBodWIuY29tIiwiRmlyc3ROYW1lIjoiQW1vbCIsIlNjcmVlbk1hcHBpbmciOiJbXCJBbGxcIl0iLCJpc3ZhbGlkIjoidHJ1ZSIsInByZWZlcnJlZF91c2VybmFtZSI6ImEubWFnYXJAc21hcnRzaGlwaHViLmNvbSIsIkRvd25sb2FkVEFSZXBvcnRzIjoiZmFsc2UiLCJSb2xlIjoiU21hcnQgU2hpcCBTdXBlciBVc2VyIiwiQ29tcGFueU5hbWUiOiJzbWFydHNoaXBodWIiLCJNb2JpbGVOdW1iZXIiOiIxMjM0NTY3ODkxIiwia2V5Y2xvYWtpZCI6IjcxOTZkNWUzLTNmZjgtNDg4My05Njc4LTUxY2NlNDVmMmRiYyIsIkRlZmF1bHRTY3JlZW5NYXBwaW5nIjoiW1wiRGFzaGJvYXJkSG9tZVwiXSIsIkNyZWF0ZVNoaXBzIjoidHJ1ZSIsImlkIjoiMTIyIiwiQ3JlYXRlUnVsZXMiOiJ0cnVlIiwiZWRpdFJ1bGVzIjoidHJ1ZSIsImVtYWlsIjoiYS5tYWdhckBzbWFydHNoaXBodWIuY29tIiwiRGVsZXRlVEFSZXBvcnRzIjoiZmFsc2UiLCJ1c2VybmFtZSI6ImEubWFnYXJAc21hcnRzaGlwaHViLmNvbSJ9.ttvVbbsE6XpmgT6hogwltx9R1KItlQwEwSl82P33_oymJP_29JYoSb1U6bgQBAUQkBHRhcEp21vFcZ2cANScxDT-6aDDsHsK5YEJ_nr7h4EgLa9kBcEazQT53FKjxJyFJ_VxqJ9fyD1qerJeMlNQh9g9jaBl5c2pu4L4Kie56IaTBE_Kilyiyi2PqsyUbHeQUVhIj44RDJAUuGeP9GcZAhHFEldygFACybqMAWuEJH9Pk0gnGyxENfoVIHN7UUs4YLGQc7Q95N8lMBJp_OIQFp4-nHHqrU0DywT0g9swaKHV5Iryc6NA3jGqprkw6z9HGkv8lOHjXcPccLFP7ynQfw' \
  -H 'x-refresh-id: eyJhbGciOiJIUzUxMiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJmZjQ0YTYwNC03Mzk0LTQ2ZDMtYjBlMC0yMWE1ZTY4MmQzNmYifQ.eyJleHAiOjE3ODg4MDM2MTYsImlhdCI6MTc4ODgwMTgxNiwianRpIjoiMWYyYTc5YzMtY2E5MC00YjQ3LTk4YmQtYTkwYWRlOGU3NDI4IiwiaXNzIjoiaHR0cHM6Ly9zbWFydHNoaXB3ZWIuY29tL2tleWNsb2FrLXByb2QvYXV0aC9yZWFsbXMvb3Jpb24iLCJhdWQiOiJodHRwczovL3NtYXJ0c2hpcHdlYi5jb20va2V5Y2xvYWstcHJvZC9hdXRoL3JlYWxtcy9vcmlvbiIsInN1YiI6IjcxOTZkNWUzLTNmZjgtNDg4My05Njc4LTUxY2NlNDVmMmRiYyIsInR5cCI6IlJlZnJlc2giLCJhenAiOiJBZ2dyZWdhdGVfU2VydmljZSIsInNpZCI6IjkzNTBmYzZlLWQ4MGYtNDYxYS04NjVhLTE1MTM4YjkzNjQzMCIsInNjb3BlIjoicm9sZXMgYWNyIHdlYi1vcmlnaW5zIHByb2ZpbGUgYmFzaWMgZW1haWwifQ.bpp93glSq9uxVIH40e8eWk4LwhjwKX0VEG2eoMTppDEvBO-DTNV7aaU3x2Dw8doVktDvB4sFqw6367w0Sb_6MA' \
  -H 'x-request-id: e7ee7ef9-d175-4845-8cc3-8e7fe81cd9ab' \
  -H 'x-tenant-id: orion'