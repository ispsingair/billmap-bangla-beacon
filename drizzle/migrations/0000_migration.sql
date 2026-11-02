CREATE TABLE public.collectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, phone text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '#2563eb',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, color text NOT NULL DEFAULT '#2563eb',
  polygon jsonb NOT NULL DEFAULT '[]'::jsonb,
  collector_id uuid REFERENCES public.collectors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '',
  lat double precision NOT NULL, lng double precision NOT NULL,
  zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL,
  monthly_bill numeric(10,2) NOT NULL DEFAULT 0,
  due_amount numeric(10,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT (date_trunc('month', now()) + interval '9 days')::date,
  last_payment_date date, last_payment_amount numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  collector_id uuid REFERENCES public.collectors(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'cash',
  paid_on date NOT NULL DEFAULT current_date,
  receipt_no text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.customers(zone_id);
CREATE INDEX ON public.payments(customer_id);
CREATE INDEX ON public.payments(paid_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collectors, public.zones, public.customers, public.payments TO authenticated;
GRANT ALL ON public.collectors, public.zones, public.customers, public.payments TO service_role;

ALTER TABLE public.collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff all collectors" ON public.collectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff all zones" ON public.zones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff all customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff add payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.apply_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE newdue numeric;
BEGIN
  SELECT greatest(0, due_amount - NEW.amount) INTO newdue FROM customers WHERE id = NEW.customer_id;
  UPDATE customers SET
    due_amount = newdue,
    last_payment_date = NEW.paid_on,
    last_payment_amount = NEW.amount,
    due_date = CASE WHEN newdue = 0
      THEN (date_trunc('month', greatest(NEW.paid_on, current_date)) + interval '1 month 9 days')::date
      ELSE due_date END
  WHERE id = NEW.customer_id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_payment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER payments_apply AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.apply_payment();

-- Demo data
INSERT INTO public.collectors(name,phone,color) VALUES
('Rahim Uddin','01711-234567','#2563eb'),('Karim Hossain','01819-456789','#db2777'),
('Sumon Mia','01912-678901','#ea580c'),('Jamal Sheikh','01556-890123','#0d9488');

INSERT INTO public.zones(name,color,polygon,collector_id)
SELECT z.name, z.color, z.poly::jsonb, c.id FROM (VALUES
('Mirpur 10','#2563eb','[[23.8114,90.3627],[23.8114,90.3747],[23.8024,90.3747],[23.8024,90.3627]]','Rahim Uddin'),
('Mirpur 11','#db2777','[[23.8235,90.3600],[23.8235,90.3720],[23.8145,90.3720],[23.8145,90.3600]]','Karim Hossain'),
('Pallabi','#ea580c','[[23.8305,90.3560],[23.8305,90.3680],[23.8215,90.3680],[23.8215,90.3560]]','Sumon Mia'),
('Kazipara','#0d9488','[[23.8020,90.3675],[23.8020,90.3795],[23.7930,90.3795],[23.7930,90.3675]]','Jamal Sheikh')
) AS z(name,color,poly,cname) JOIN public.collectors c ON c.name = z.cname;

INSERT INTO public.customers(name,phone,address,lat,lng,zone_id,monthly_bill,due_amount,due_date,last_payment_date,last_payment_amount)
SELECT v.name, v.phone, v.addr || ', Dhaka', v.lat, v.lng, z.id, v.bill, v.due, v.dd::date, v.lp::date, v.bill
FROM (VALUES
('Nasrin Sarkar','01356-711097','House 8, Rd 7, Mirpur 10',23.80338,90.36804,1,800,2400,'2026-10-10','2026-09-01'),
('Sharmin Rahman','01982-229815','House 29, Rd 1, Mirpur 10',23.80749,90.36767,1,500,0,'2026-12-10','2026-10-15'),
('Ayesha Khan','01479-223514','House 74, Lane 4, Mirpur 10',23.80736,90.37052,1,600,0,'2026-12-10','2026-10-28'),
('Rashida Islam','01718-691783','House 8, Rd 7, Mirpur 10',23.80687,90.36902,1,500,500,'2026-11-10','2026-10-04'),
('Rashida Akter','01433-832948','House 32, Rd 3, Mirpur 10',23.80747,90.36895,1,800,800,'2026-11-10','2026-10-08'),
('Shirin Islam','01375-538433','House 22, Block C, Mirpur 10',23.80426,90.36859,1,800,800,'2026-11-10','2026-10-05'),
('Masud Begum','01598-467188','House 77, Sec 6, Mirpur 10',23.80751,90.36826,1,500,1000,'2026-10-10','2026-09-09'),
('Shafiqul Alam','01849-778563','House 74, Sec 6, Mirpur 10',23.80526,90.36756,1,500,1500,'2026-10-10','2026-09-02'),
('Rashida Hossain','01724-617674','House 8, Rd 7, Mirpur 10',23.80894,90.36499,1,1500,0,'2026-12-10','2026-10-18'),
('Nasrin Hossain','01661-676129','House 36, Rd 5, Mirpur 10',23.80933,90.37234,1,600,0,'2026-12-10','2026-10-17'),
('Ruma Khan','01429-187015','House 23, Rd 5, Mirpur 11',23.81696,90.36333,2,800,800,'2026-11-10','2026-10-06'),
('Ayesha Rahman','01463-660559','House 48, Block C, Mirpur 11',23.82244,90.36790,2,1000,2000,'2026-10-10','2026-09-05'),
('Ruma Sarkar','01660-518359','House 51, Rd 3, Mirpur 11',23.81886,90.36500,2,1200,2400,'2026-10-10','2026-09-08'),
('Arif Hossain','01353-729908','House 7, Rd 3, Mirpur 11',23.81520,90.36251,2,600,0,'2026-12-10','2026-10-26'),
('Sabina Miah','01629-765226','House 33, Block C, Mirpur 11',23.81978,90.36574,2,500,1000,'2026-10-10','2026-09-02'),
('Delwar Akter','01328-207151','House 96, Block C, Mirpur 11',23.82083,90.36579,2,500,1500,'2026-10-10','2026-09-08'),
('Sabina Sarkar','01528-823588','House 70, Rd 1, Mirpur 11',23.82096,90.36398,2,1500,0,'2026-12-10','2026-11-01'),
('Rashida Hossain','01538-658463','House 70, Block C, Mirpur 11',23.82004,90.36713,2,1500,4500,'2026-10-10','2026-09-09'),
('Faruk Sarkar','01655-866513','House 4, Rd 1, Mirpur 11',23.82120,90.36572,2,600,1800,'2026-10-10','2026-09-04'),
('Arif Alam','01556-184450','House 29, Rd 3, Mirpur 11',23.81692,90.36297,2,600,600,'2026-11-10','2026-10-06'),
('Abdul Chowdhury','01854-938487','House 83, Rd 3, Pallabi',23.82854,90.35820,3,600,600,'2026-11-10','2026-10-10'),
('Rafiq Khan','01991-448669','House 12, Block D, Pallabi',23.82572,90.36443,3,1000,2000,'2026-10-10','2026-09-08'),
('Tanvir Rahman','01485-587958','House 84, Rd 5, Pallabi',23.82685,90.36296,3,500,500,'2026-11-10','2026-10-03'),
('Tanvir Sarkar','01726-122436','House 2, Rd 3, Pallabi',23.82620,90.36634,3,1000,1000,'2026-11-10','2026-10-06'),
('Abdul Akter','01447-625506','House 31, Block C, Pallabi',23.82417,90.36119,3,1000,2000,'2026-10-10','2026-09-04'),
('Arif Uddin','01776-541060','House 65, Rd 5, Pallabi',23.82624,90.36224,3,600,0,'2026-12-10','2026-10-21'),
('Abdul Hossain','01428-596493','House 80, Rd 3, Pallabi',23.82643,90.36026,3,500,1000,'2026-10-10','2026-09-10'),
('Farhana Sarkar','01341-300599','House 36, Rd 1, Pallabi',23.82807,90.36208,3,1200,1200,'2026-11-10','2026-10-08'),
('Arif Begum','01774-735581','House 66, Rd 7, Pallabi',23.82746,90.36152,3,1200,0,'2026-12-10','2026-10-30'),
('Mizanur Sarkar','01467-243795','House 54, Rd 3, Pallabi',23.82518,90.36016,3,1200,2400,'2026-10-10','2026-09-09'),
('Sabina Uddin','01525-914672','House 20, Block C, Kazipara',23.79479,90.37733,4,1500,0,'2026-12-10','2026-10-30'),
('Kamrul Chowdhury','01495-972881','House 29, Rd 5, Kazipara',23.79907,90.37844,4,1000,0,'2026-12-10','2026-10-29'),
('Rashida Begum','01356-120429','House 44, Sec 6, Kazipara',23.79705,90.36868,4,1000,0,'2026-12-10','2026-10-26'),
('Nazma Islam','01339-209869','House 11, Lane 4, Kazipara',23.79577,90.37756,4,800,800,'2026-11-10','2026-10-05'),
('Sharmin Uddin','01943-525667','House 20, Sec 6, Kazipara',23.79902,90.36939,4,600,0,'2026-12-10','2026-10-28'),
('Nasrin Akter','01391-192868','House 34, Rd 3, Kazipara',23.79832,90.37072,4,500,1000,'2026-10-10','2026-09-07'),
('Habibur Sarkar','01644-751903','House 17, Rd 1, Kazipara',23.79770,90.37088,4,800,2400,'2026-10-10','2026-09-01'),
('Rafiq Ahmed','01590-419821','House 68, Rd 7, Kazipara',23.79590,90.37350,4,500,1500,'2026-10-10','2026-09-01'),
('Mizanur Rahman','01312-868690','House 65, Rd 7, Kazipara',23.79761,90.37096,4,600,0,'2026-12-10','2026-11-01'),
('Ruma Chowdhury','01760-631298','House 40, Rd 7, Kazipara',23.80117,90.37193,4,1000,0,'2026-12-10','2026-10-19')
) AS v(name,phone,addr,lat,lng,zno,bill,due,dd,lp)
JOIN (VALUES (1,'Mirpur 10'),(2,'Mirpur 11'),(3,'Pallabi'),(4,'Kazipara')) AS m(zno,zname) ON m.zno = v.zno
JOIN public.zones z ON z.name = m.zname;

ALTER TABLE public.payments DISABLE TRIGGER payments_apply;
INSERT INTO public.payments(customer_id,collector_id,amount,method,paid_on,receipt_no,created_by)
SELECT c.id, z.collector_id, c.last_payment_amount,
  (ARRAY['cash','bkash','nagad','cash'])[1 + (abs(hashtext(c.phone)) % 4)],
  c.last_payment_date, 'R-' || (10000 + abs(hashtext(c.name || c.phone)) % 90000), NULL
FROM public.customers c JOIN public.zones z ON z.id = c.zone_id;
ALTER TABLE public.payments ENABLE TRIGGER payments_apply;