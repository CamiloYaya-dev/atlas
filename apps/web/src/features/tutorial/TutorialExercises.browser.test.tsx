import {it,expect,vi} from 'vitest'
import {fireEvent,render,screen} from '@testing-library/react'
import TutorialExercises from './TutorialExercises'
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}))
it('C4 exige orden de contexto a código y completa una sola vez',()=>{
 const done=vi.fn();render(<TutorialExercises kind="drill" onComplete={done}/>)
 expect((screen.getByRole('button',{name:'C4 · Código'}) as HTMLButtonElement).disabled).toBe(true)
 for(const name of ['C1 · Contexto','C2 · Contenedores','C3 · Componentes','C4 · Código'])click(name)
 expect(screen.getByRole('status').textContent).toContain('Recorrido completo');expect(done).toHaveBeenCalledTimes(1)
})
it('perspectivas muestran información distinta y no repiten la finalización',()=>{
 const done=vi.fn();render(<TutorialExercises kind="perspective" onComplete={done}/>)
 expect(screen.getByText(/Funcional: una persona/)).toBeTruthy();click('Mixta');expect(screen.getByText(/Mixta: el guardado/)).toBeTruthy();expect(done).not.toHaveBeenCalled();click('Técnica');expect(screen.getByText(/Técnica: una petición/)).toBeTruthy();click('Técnica');expect(done).toHaveBeenCalledTimes(1)
})
it('relaciones requieren origen y permiten repetir la simulación',()=>{
 const done=vi.fn();render(<TutorialExercises kind="relation" onComplete={done}/>)
 expect((screen.getByRole('button',{name:'API de proyectos'}) as HTMLButtonElement).disabled).toBe(true);click('Editor web');click('API de proyectos');expect(screen.getByRole('status').textContent).toContain('Relación creada');click('Editor web');expect(screen.queryByRole('status')).toBeNull();click('API de proyectos');expect(done).toHaveBeenCalledTimes(2)
})
it('cambiar ejercicio reinicia el estado, y vínculo requiere elegir origen',()=>{
 const done=vi.fn();const view=render(<TutorialExercises kind="link" onComplete={done}/>)
 expect((screen.getByRole('button',{name:'C3 · Proyectos'}) as HTMLButtonElement).disabled).toBe(true);click('API de proyectos');click('C3 · Proyectos');expect(screen.getByRole('status').textContent).toContain('doble clic');view.rerender(<TutorialExercises kind="reuse" onComplete={done}/>);expect(screen.queryByRole('status')).toBeNull();click('Añadir a trazabilidad');expect(screen.getByRole('status').textContent).toContain('Sin duplicación');expect(done).toHaveBeenCalledTimes(2)
})
