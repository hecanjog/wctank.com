form Sound to TextGrid (silences)
	sentence path
	sentence output_name
endform

Read from file: path$
To Intensity... 20 0.0
To TextGrid (silences)... -10.0 0.1 0.05 silent sounding

file$ = output_name$ + ".TextGridIntervals"

num = Get number of intervals... 1

for i from 1 to num
	label$ = Get label of interval... 1 i
	if label$ = "sounding"
		start = Get start point... 1 i
		end = Get end point... 1 i
		appendFileLine: file$, start,  " ", end
	endif
endfor



