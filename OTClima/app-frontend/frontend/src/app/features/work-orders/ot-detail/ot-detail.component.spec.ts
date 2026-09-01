import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTabGroup } from '@angular/material/tabs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkOrder } from '../../../core/models';
import { WorkOrdersService } from '../../../core/services/work-orders.service';
import { CompanyService } from '../../../core/services/company.service';
import { CommercialTextsService } from '../../../core/services/commercial-texts.service';
import { AuthService } from '../../../core/auth/auth.service';
import { OtDetailComponent } from './ot-detail.component';

describe('OtDetailComponent status history', () => {
  let fixture: ComponentFixture<OtDetailComponent>;
  let workOrders: jasmine.SpyObj<WorkOrdersService>;

  const baseOrder: WorkOrder = {
    id: 25,
    company_id: 1,
    client_id: 1,
    title: 'Mantención equipo',
    status: 'quotation_sent',
    visit_type: 'free',
    visit_cost: 0,
    created_at: '2026-07-26T14:30:00Z',
    updated_at: '2026-07-26T16:30:00Z',
    status_history: [
      {
        id: 102,
        from_status: 'diagnosis',
        to_status: 'quotation_sent',
        created_at: '2026-07-26T16:30:00Z',
        changed_by: { id: 7, name: 'Felipe Rojas', email: 'felipe@empresa.cl' },
      },
      {
        id: 101,
        from_status: null,
        to_status: 'diagnosis',
        created_at: '2026-07-26T14:30:00Z',
        changed_by: { id: 4, name: 'Camila Torres', email: 'camila@empresa.cl' },
      },
    ],
  };

  beforeEach(async () => {
    workOrders = jasmine.createSpyObj<WorkOrdersService>('WorkOrdersService', [
      'getWorkOrder', 'getEvidences', 'transitionOt', 'markQuotationSent',
      'registerPayment', 'uploadEvidence', 'getPdf',
    ]);
    workOrders.getWorkOrder.and.returnValue(of({
      ...baseOrder,
      status_history: [...baseOrder.status_history].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    }));
    workOrders.getEvidences.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [OtDetailComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '25' } } } },
        { provide: WorkOrdersService, useValue: workOrders },
        { provide: CompanyService, useValue: { getCompany: () => of({ id: 1 }) } },
        { provide: CommercialTextsService, useValue: { activeOptions: () => [] } },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ id: 4, name: 'Camila Torres', email: 'camila@empresa.cl', role: 'admin' }),
            isAdmin: () => true,
            logout: jasmine.createSpy('logout'),
          },
        },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OtDetailComponent);
    fixture.detectChanges();
  });

  it('shows the selected movement in its modal with user, email and date', () => {
    expect(fixture.nativeElement.querySelector('.status-history')).toBeNull();

    const steps = [...fixture.nativeElement.querySelectorAll('.step')] as HTMLElement[];
    steps[0].click();
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('.movement-detail-modal') as HTMLElement;
    expect(modal.textContent).toContain('Orden creada en Diagnóstico');
    expect(modal.textContent).toContain('Camila Torres');
    expect(modal.textContent).toContain('camila@empresa.cl');
    expect(modal.querySelector('time')?.textContent?.trim()).toBeTruthy();
    expect(steps[0].classList).toContain('detail-open');
  });

  it('reloads the order and renders rejection after an action', () => {
    const rejected: WorkOrder = {
      ...baseOrder,
      status: 'rejected',
      status_history: [
        ...baseOrder.status_history,
        {
          id: 103,
          from_status: 'quotation_sent',
          to_status: 'rejected',
          created_at: '2026-07-26T17:00:00Z',
          changed_by: { id: 4, name: 'Camila Torres', email: 'camila@empresa.cl' },
        },
      ],
    };
    workOrders.transitionOt.and.returnValue(of(rejected));
    workOrders.getWorkOrder.and.returnValue(of(rejected));
    (fixture.componentInstance as any).dialog = {
      open: () => ({ afterClosed: () => of(true) }),
    };

    fixture.componentInstance.doTransition('rejected');
    fixture.detectChanges();

    expect(workOrders.transitionOt).toHaveBeenCalledWith(25, 'rejected');
    expect(workOrders.getWorkOrder).toHaveBeenCalledTimes(2);
    const rejectedBadge = fixture.nativeElement.querySelector('.rejected-badge') as HTMLElement;
    rejectedBadge.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.movement-detail-modal').textContent)
      .toContain('Cotización enviada → Rechazada');
    expect(rejectedBadge.classList).toContain('detail-open');
  });

  it('renders evidences and uploader metadata in the evidences tab', fakeAsync(() => {
    fixture.componentInstance.evidences.set([
      {
        id: 8,
        description: 'Equipo antes de reparación',
        stage: 'diagnosis',
        uploaded_at: '2026-07-26T14:30:00Z',
        url: '/api/v1/work-orders/evidences/archivo.jpg',
        uploaded_by: { id: 4, name: 'Camila Torres', email: 'camila@empresa.cl' },
      },
      {
        id: 9,
        description: 'Equipo reparado',
        stage: 'finished',
        uploaded_at: '2026-07-26T18:30:00Z',
        url: '/api/v1/work-orders/evidences/final.jpg',
        uploaded_by: null,
      },
    ]);

    fixture.detectChanges();
    const tabGroup = fixture.debugElement.query(By.directive(MatTabGroup)).componentInstance as MatTabGroup;
    tabGroup.selectedIndex = 2;
    fixture.detectChanges();
    tick(500);
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('.evidence-tab') as HTMLElement;
    expect(content.textContent).toContain('Equipo antes de reparación');
    expect(content.textContent).toContain('Subida por: Camila Torres');
    expect(content.textContent).toContain('camila@empresa.cl');
    expect(content.textContent).toContain('Equipo reparado');
    expect(content.textContent).toContain('Usuario no disponible');

    (content.querySelector('.evidence-preview-button') as HTMLElement).click();
    fixture.detectChanges();
    const lightbox = fixture.nativeElement.querySelector('.evidence-lightbox') as HTMLElement;
    expect(lightbox).toBeTruthy();
    expect(lightbox.querySelector('img')?.getAttribute('src')).toContain('archivo.jpg');

    fixture.componentInstance.closeEvidencePreviewOnEscape();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.evidence-lightbox')).toBeNull();
  }));
});
