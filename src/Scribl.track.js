/**
 * Scribl::Track
 *
 * _Tracks are used to segregrate different sequence data_
 *
 * Chase Miller 2011
 */


var Track = Class.extend({
	/** **init**

    * _Constructor_
    *
    * This is called with `new Track()`, but to create new Tracks associated with a chart use `Scribl.addTrack()`
    *
    * @param {Object} ctx - the canvas.context object
    * @api internal
    */
	init: function(ctx) {
      // defaults
      this.lanes = [];
      this.ctx = ctx;
      this.uid = _uniqueId('track');      
      this.drawStyle = undefined;
      
      // coverage variables
      this.coverageData = [];  // number of features at any given pixel;
      this.maxDepth = 0; // highest depth for this track;
	},
	
	/** **addLane**

    * _creates a new Lane associated with this Track_

    * @return {Object} Lane - a Lane object
    * @api public
    */
	addLane: function() {
      var lane = new Lane(this.ctx, this);
      this.lanes.push(lane);
      return lane;
   },
	
	/** **addGene**
   
    * _syntactic sugar function to add a feature with the gene type to this Track_
   
    * @param {Int} position - start position of the gene
    * @param {Int} length - length of the gene
    * @param {String} strand - '+' or '-' strand
    * @param {Hash} [opts] - optional hash of options that can be applied to gene  
    * @return {Object} gene - a feature with the 'gene' type
    * @api public
    */
	addGene: function(position, length, strand, opts) {
      return (this.addFeature( new BlockArrow("gene", position, length, strand, opts) ) );
   },
	
	/** **addProtein**
   
    * _syntactic sugar function to add a feature with the protein type to this Track_
   
    * @param {Int} position - start position of the protein
    * @param {Int} length - length of the protein
    * @param {String} strand - '+' or '-' strand
    * @param {Hash} [opts] - optional hash of options that can be applied to protein  
    * @return {Object} protein - a feature with the 'protein' type
    * @api public
    */
	addProtein: function(position, length, strand, opts) {
      return (this.addFeature( new BlockArrow("protein", position, length, strand, opts) ) );
   },
	
	/** **addFeature**
   
    * _addFeature to this Track and let Scribl manage lane placement to avoid overlaps_
    
    * example:
    * `track.addFeature( new Rect('complex',3500, 2000) );`
   
    * @param {Object} feature - any of the derived Glyph classes (e.g. Rect, Arrow, etc..)
    * @return {Object} feature - new feature
    * @api public        
    */
	addFeature: function( feature ) {
		
      var curr_lane;
      var new_lane = true;
      
      // try to add feature at lower lanes then move up
      for (var j=0; j < this.lanes.length; j++) {
         var prev_feature = this.lanes[j].features[ this.lanes[j].features.length - 1 ];

         // check if new lane is needed
         if ( prev_feature != undefined && (feature.position - 3/this.chart.pixelsToNts()) > (prev_feature.position + prev_feature.length) ) {
            new_lane = false;
            curr_lane = this.lanes[j];
            break;
         }
      }

      // add new lane if needed
      if (new_lane)
         curr_lane = this.addLane();
			
      // add feature
      curr_lane.addFeature( feature );	
      return feature;
   },
	
	/** **getDrawStyle**
   
    * _returns the draw style associated with this track_
   
    * @return {String} drawStyle - the style this track will be drawn e.g. expand, collapse, line     
    * @api public        
    */
   getDrawStyle: function() {
      if (this.drawStyle)
         return this.drawStyle
      else
         return this.chart.drawStyle;
   },
	
	/** **getHeight**
   
    * _returns the height of this track in pixels_
   
    * @return {Int} height
    * @api public        
    */
	getHeight: function() {
      var wholeHeight = 0;
		
      var numLanes = this.lanes.length;
      var laneBuffer = this.chart.laneBuffer;
      var drawStyle = this.getDrawStyle();
      if (drawStyle == 'line' || drawStyle == 'collapse')
         numLanes = 1;
		
      for (var i=0; i < numLanes; i++) {
         wholeHeight += laneBuffer;
         wholeHeight += this.lanes[i].getHeight();
      }
      // subtract 1 laneBuffer b\c laneBuffers are between lanes
      wholeHeight -= laneBuffer;
		
      return wholeHeight;
   },
	
	/** **getPixelPositionY**
   
    * _gets the number of pixels from the top of the chart to the top of this track_
   
    * @return {Int} pixelPositionY
    * @api public        
    */
   getPixelPositionY: function() {
      var track = this;
      var y = track.chart.getScaleHeight() + track.chart.laneBuffer;

      for( var i=0; i < track.chart.tracks.length; i++ ) {
         if (track.uid == track.chart.tracks[i].uid) break;
         y += track.chart.trackBuffer;
         y += track.chart.tracks[i].getHeight();
      }
   
      return y; 
   },
	
	/** **calcCoverageData**
   
    * _calculates the coverage (the number of features) at each pixel_
    *
    * @api internal    
    */
   calcCoverageData: function() {
      var lanes = this.lanes 
	   
	   // determine feature locations
      for (var i=0; i<lanes.length; i++) {
         for (var k=0; k<lanes[i].features.length; k++) {
            var feature = lanes[i].features[k];
            var from = Math.round( feature.getPixelPositionX() );
            var to =  Math.round( from + feature.getPixelLength() );
            for (var j=from; j <= to; j++) { 
               this.coverageData[j] = this.coverageData[j] + 1 || 1; 
               this.maxDepth = Math.max(this.coverageData[j], this.maxDepth);
            }
         }
      }     
   },
   
   /** **erase**
   
    * _erases this track_
    *
    * @api internal    
    */
   erase: function() {
      var track = this;
      track.chart.ctx.clearRect(0, track.getPixelPositionY(), track.chart.width, track.getHeight());
   },
	
	/** **draw**
   
    * _draws Track_
   
    * @api internal   
    */
	draw: function() {
      var track = this;
      var style = track.getDrawStyle();
      var laneSize = track.chart.laneSizes;
      var lanes = track.lanes;
      var laneBuffer = track.chart.laneBuffer;
      var trackBuffer = track.chart.trackBuffer;
      var y =  laneSize + trackBuffer;
      var ctx = track.ctx;
      
      // draw lanes
      
      // draw expanded/default style
      if ( style == undefined || style == 'expand' ) {   		
         for (var i=0; i<lanes.length; i++) {
            lanes[i].y = y;
            lanes[i].draw();
            var height = lanes[i].getHeight();
            ctx.translate(0, height + laneBuffer);
            y = y + height + laneBuffer;
         }
      } else if ( style == 'collapse' ) { // draw collapse style (i.e. single lane)
         var features = []
         // concat all features into single array
         for (var i=0; i<lanes.length; i++) {
            var features = features.concat(lanes[i].features);
         }
         // sort features so the minimal number of lanes are used
         features.sort( function(a,b){ return(a.position - b.position); } );
         for (var j=0; j<features.length; j++) {
            var originalLength = features[j].length;
            var originalName = features[j].name;
            var m = undefined;
            for( m=j+1; m < features.length; m++) {
               // if a feature is overlapping change length to draw as a single feature
               if (features[j].getEnd() >= features[m].position) {
                  features[j].length = Math.max(features[j].getEnd(), features[m].getEnd()) - features[j].position;
                  features[j].name = "";
               } else break;
            }               
            // draw
            features[j].draw();
            // put length and name back to correct values
            features[j].length = originalLength;
            features[j].name = originalName;
            // update j to skip features that were merged
            j = m-1;
         }
         // translate down to next lane to draw
         ctx.translate(0, lanes[0].getHeight() + laneBuffer);
   
      // draw as a line chart of the coverage
      } else if ( style == 'line' ) {
         if (track.coverageData.length == 0) track.calcCoverageData();
   	   
         var normalizationFactor = this.maxDepth;

         ctx.beginPath();
//         ctx.moveTo(this.chart.offset, laneSize);
         for (var k=this.chart.offset; k <= this.chart.width + this.chart.offset; k++) {
            var normalizedPt = track.coverageData[k] / normalizationFactor * laneSize || 0;
            normalizedPt = laneSize - normalizedPt;
            ctx.lineTo(k, normalizedPt);
         }
         ctx.lineTo(this.chart.width + this.chart.offset, laneSize)
//		   ctx.lineTo(this.chart.offset, laneSize);
         ctx.stroke();
         ctx.translate(0, lanes[0].getHeight() + laneBuffer);
      }
   	
      // add track buffer - extra laneBuffer
      ctx.translate(0,trackBuffer-laneBuffer);
		
   }
});
