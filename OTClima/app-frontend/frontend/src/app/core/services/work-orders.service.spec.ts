import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WorkOrdersService } from './work-orders.service';

describe('WorkOrdersService evidences', () => {
  let service: WorkOrdersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WorkOrdersService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkOrdersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('normalizes legacy evidences, missing uploader and duplicate ids', () => {
    let result: any[] = [];
    service.getEvidences(25).subscribe((evidences) => result = evidences);

    const request = http.expectOne((req) => req.url.endsWith('/work-orders/25/evidences'));
    request.flush([
      { id: 8, description: null, stage: 'execution', uploaded_at: '2026-07-26T14:30:00Z', url: '/a.jpg' },
      { id: 8, description: null, stage: 'execution', uploaded_at: '2026-07-26T14:30:00Z', url: '/a.jpg' },
    ]);

    expect(result.length).toBe(1);
    expect(result[0].stage).toBe('in_execution');
    expect(result[0].uploaded_by).toBeNull();
    expect(result[0].description).toBe('');
  });

  it('uploads only the file and description', () => {
    const file = new File(['image'], 'evidence.jpg', { type: 'image/jpeg' });
    service.uploadEvidence(25, file, 'Equipo reparado').subscribe();

    const request = http.expectOne((req) => req.url.endsWith('/work-orders/25/evidences'));
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('description')).toBe('Equipo reparado');
    expect(body.has('stage')).toBeFalse();
    expect(body.has('uploaded_by')).toBeFalse();
    expect(body.has('uploaded_at')).toBeFalse();

    request.flush({
      id: 9,
      description: 'Equipo reparado',
      stage: 'finished',
      uploaded_at: '2026-07-26T18:30:00Z',
      url: '/final.jpg',
      uploaded_by: null,
    });
  });
});
