# Airspace Beetle

## Todo

### Add to localstorage:
+ All map data, locations, etc
+ Drone range
+ Weights
+ Map zoom and pan/centre location

### General
+ Rationalise `networks` vs `trusts` labelling
+ In networks, show the total number of locations in/out of range, number of hubs etc
+ In routes, show the totals and distances better

### Features
+ Rebuild the add waypoints / edit waypoints functionality
+ Or disable this for now, whilst hub editing is possible?
+ I guess changing a hub deletes and re-builds that waypoints row?
+ Sort hover effects when editing a line
+ ~~Continually update the distance of the route when dragging~~ (show straight line distance AND full path distance)
+ Colour routes by distance along a gradient - toggle on/off
+ Make filters section, filter by drone range, by date etc
+ Lock CSV import after you start adding points
+ Ctrl+click to delete a node on a route
+ On the "Data" tab, add in option to upload list of all secondary locations, and then connect them to a destination if less than x (e.g. 3 miles) distance (for onward bike courier etc)
+ Do "click+drag" in one step if you add the waypoint on mousedown, not on click
+ Add arrows to show direction of travel along each route
+ Display coordinates for waypoint when hovering

### CSV importer
+ Check for duplicate rows