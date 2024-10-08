import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const More2Fill = (props: SvgProps) => (
  <Svg width={props.width || 24} viewBox={'0 0 24 24'} height={props.height || 24} fill="none" {...props}>
    <Path
      fill={props.color || '#2D3748'}
      d="M12 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm0 14c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm0-7c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Z"
    />
  </Svg>
);
export default More2Fill;
