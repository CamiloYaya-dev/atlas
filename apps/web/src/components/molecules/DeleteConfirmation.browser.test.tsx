import {it,expect,vi} from 'vitest'
import {fireEvent,render,screen,within} from '@testing-library/react'
import {DeleteConfirmation} from './DeleteConfirmation'
it('confirmación exacta, reconocimiento, errores y bloqueo mientras guarda',()=>{
 const props={title:'Borrar organización',name:'QA',description:'Borrado controlado',consequences:'Elimina proyectos',checkboxLabel:'Entiendo el alcance',busy:false,error:'',onCancel:vi.fn(),onConfirm:vi.fn().mockResolvedValue(undefined)}
 const view=render(<DeleteConfirmation {...props}/>);const dialog=screen.getByRole('dialog'),text=within(dialog).getByRole('textbox'),button=within(dialog).getByRole('button',{name:'Eliminar definitivamente'}) as HTMLButtonElement
 expect(button.disabled).toBe(true);fireEvent.change(text,{target:{value:'qa'}});fireEvent.click(within(dialog).getByRole('checkbox'));expect(button.disabled).toBe(true);fireEvent.change(text,{target:{value:'QA'}});expect(button.disabled).toBe(false);fireEvent.click(button);expect(props.onConfirm).toHaveBeenCalledOnce()
 view.rerender(<DeleteConfirmation {...props} busy error="Error remoto"/>);expect(screen.getByRole('alert').textContent).toContain('Error remoto');expect((screen.getByRole('button',{name:'Eliminando…'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(within(dialog).getByRole('button',{name:'Cerrar'}));expect(props.onCancel).not.toHaveBeenCalled()
 view.rerender(<DeleteConfirmation {...props}/>);fireEvent.click(within(dialog).getByRole('button',{name:'Cerrar'}));expect(props.onCancel).toHaveBeenCalledOnce()
})
