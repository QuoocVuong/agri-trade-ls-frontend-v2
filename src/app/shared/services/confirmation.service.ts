import { Injectable, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import {
  ConfirmationInput,
  ConfirmationModalComponent
} from '../components/confirmation-modal/confirmation-modal.component';
import { Subject } from 'rxjs';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  iconClass?: string;
  iconColorClass?: string;
  inputs?: ConfirmationInput[];
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  private componentRef: any;

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  public open(options: ConfirmationOptions): Subject<any> {
    const result$ = new Subject<any>();

    // Tạo component và gắn vào cây DOM
    this.componentRef = createComponent(ConfirmationModalComponent, {
      environmentInjector: this.injector
    });

    // Gán các giá trị từ options
    Object.assign(this.componentRef.instance, options, { isOpen: true });

    // Lắng nghe sự kiện
    this.componentRef.instance.confirmed.subscribe((inputValues: { [key: string]: string }) => {
      result$.next(inputValues);
      this.destroy();
    });

    this.componentRef.instance.cancelled.subscribe(() => {
      result$.next(false);
      this.destroy();
    });

    // Gắn component vào ApplicationRef để nó được render
    this.appRef.attachView(this.componentRef.hostView);
    const domElem = (this.componentRef.hostView as any).rootNodes[0] as HTMLElement;
    document.body.appendChild(domElem);

    return result$;
  }

  private destroy(): void {
    if (this.componentRef) {
      this.appRef.detachView(this.componentRef.hostView);
      this.componentRef.destroy();
    }
  }
}
