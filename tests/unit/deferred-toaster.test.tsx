import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
vi.mock('next/dynamic',()=>({default:()=>function FakeToaster(){return <div data-testid="toaster"/>;}}));
import {DeferredToaster} from '@/components/site/DeferredToaster';
it('does not mount the toast library before a notification is requested',()=>{
 render(<DeferredToaster/>);
 expect(screen.queryByTestId('toaster')).not.toBeInTheDocument();
});
