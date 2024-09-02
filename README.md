# Airspace Beetle

## Todo

+ ~~Highlight the routes from a hub when you hover over it in the list~~
+ ~~Add line numbers to the imported data~~
+ ~~Add an error message where imported data rows are skipped~~ and reasons why (e.g. "skipping line 6, incorrect XX")
+ ~~Add export to KML link~~
+ Add a date timeline
+ ~~Add list of how many routes there are (and what length they are)~~
+ ~~Add the slider for route length cutoff back in~~
+ ~~Move initial example data to separate file~~
+ ~~Use localStorage to save data and any settings~~

+ Sort hover effects when editing a line
+ ~~Continually update the distance of the route when dragging~~ (show straight line distance AND full path distance)
+ Colour routes by distance along a gradient - toggle on/off
+ Make filters section, filter by drone range, by date etc
+ Lock CSV import after you start adding points
+ ~~Make flow Import -> Design -> Export~~
+ localStorage for geoJSON not just the original CSV
+ ~~Fix correct cursor when hovering on a waypoint that can be dragged~~
+ ~~Snap to waypoint using turf.distance calc - https://stackoverflow.com/questions/39417535/mapbox-icons-markers-bearingsnap-or-snap-to-position~~
+ Make lines that are filtered out about 10% opacity
+ Check for duplicate rows
+ Ctrl+click to delete a node on a route
+ ~~Add waypoints tool~~
+ Do "click+drag" in one step if you add the waypoint on mousedown, not on click
+ On the "Data" tab, add in option to upload list of all secondary locations, and then connect them to a destination if less than x (e.g. 3 miles) distance (for onward bike courier etc)
+ Add arrows to show direction of travel along each route
+ Need to split out the routes by source -> destination or vice versa.
+ Have two tabs at the top/side - one for "Data" and one for "Map" - maybe a nice icon in a square box
+ Display coordinates for waypoint when hovering