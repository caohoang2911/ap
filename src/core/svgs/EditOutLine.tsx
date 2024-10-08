import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';
const EditOutLine = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" width={24} height={24} fill="none" {...props}>
    <Path
      fill={props.color || '#2D3748'}
      d="m16.757 3-2 2H5v14h14V9.243l2-2V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12.757Zm3.728-.9L21.9 3.516l-9.192 9.192-1.412.003-.002-1.417L20.485 2.1Z"
    />
  </Svg>
);
export default EditOutLine;
