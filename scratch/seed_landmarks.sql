-- Update Chitwan, Nuwakot, Makwanpur district hub contact details to match reference screenshot
UPDATE branches SET contact_person = 'Saroj Sunam', phone = '9712039228', municipality = 'Bharatpur' WHERE id = 43;
UPDATE branches SET contact_person = 'Sujan Chettri', phone = '9707059242', municipality = 'Bidur' WHERE id = 37;
UPDATE branches SET contact_person = 'Anup Neupane', phone = '9712039159', municipality = 'Hetauda' WHERE id = 39;

-- Also set municipality for the municipal branches
UPDATE branches SET municipality = 'Bharatpur' WHERE id = 434;
UPDATE branches SET municipality = 'Bidur' WHERE id = 381;
UPDATE branches SET municipality = 'Hetauda' WHERE id = 404;

-- Clean any existing duplicate landmarks for these branches before re-inserting
DELETE FROM landmarks WHERE branch_id IN (43, 434, 37, 381, 39, 404, 1, 2);

-- 1. Chitwan (Bharatpur) Landmarks for branch_id 43
INSERT INTO landmarks (company_id, branch_id, name) VALUES
(1, 43, 'Bharatpur'), (1, 43, 'Aaptari'), (1, 43, 'Adharsha Chowk'), (1, 43, 'Ashok Chowk'),
(1, 43, 'Barhaghare Area'), (1, 43, 'Basant Chowk Area'), (1, 43, 'Baseni Area'), (1, 43, 'Belchowk Area'),
(1, 43, 'Bel Chowk'), (1, 43, 'Bel'), (1, 43, 'Bharaghara'), (1, 43, 'Bhojad Area'),
(1, 43, 'Bhrikuti Paper Mills Area'), (1, 43, 'Bikash Chowk'), (1, 43, 'Buddha Chowk'), (1, 43, 'Buspark Area'),
(1, 43, 'Cancer Hospital Gate 1'), (1, 43, 'Cancer Hospital Gate 2'), (1, 43, 'Cancer Hospital Gate 3'),
(1, 43, 'Cdo Karyalaya'), (1, 43, 'Champa Chaur Area'), (1, 43, 'Chetrapur'), (1, 43, 'Chisapani Tol'),
(1, 43, 'Chowk Bazzar'), (1, 43, 'Cmc Hospital'), (1, 43, 'Cmc Hostel'), (1, 43, 'Devghat Wari'),
(1, 43, 'Dhangada Mandir'), (1, 43, 'Dharey Chowk'), (1, 43, 'Dharma Chowk'), (1, 43, 'Dipendra Chowk'),
(1, 43, 'Fulbari'), (1, 43, 'Furti Chowk'), (1, 43, 'Gabisa Chowk'), (1, 43, 'Ganesh Chowk'),
(1, 43, 'Gauriganj Area'), (1, 43, 'Gautam Chowk'), (1, 43, 'Gitanagar'), (1, 43, 'Gondrang'),
(1, 43, 'Gorkhali Tol'), (1, 43, 'Gundrang'), (1, 43, 'Hakim Chowk'), (1, 43, 'Indradev Marga Area'),
(1, 43, 'Jalma Hall Area'), (1, 43, 'Junhall Road'), (1, 43, 'Kailash Nagar'), (1, 43, 'Kalyanpur'),
(1, 43, 'Kamal Nagar Area'), (1, 43, 'Kathar Chowk'), (1, 43, 'Krishnapur'), (1, 43, 'Lankhu Area'),
(1, 43, 'Lankhu Pul'), (1, 43, 'Lions Chowk Area'), (1, 43, 'Makhan Chowk'), (1, 43, 'Malpot Karyalaya'),
(1, 43, 'Mangalpur'), (1, 43, 'Nahar Chowk'), (1, 43, 'Narayangarh'), (1, 43, 'Narayani Path Area'),
(1, 43, 'Naryanpur'), (1, 43, 'Naurange'), (1, 43, 'New Road'), (1, 43, 'Paras Buspark'),
(1, 43, 'Pokhara Buspark Area'), (1, 43, 'Pokhara Buspark'), (1, 43, 'Pokhari Chowk'), (1, 43, 'Prem Basti'),
(1, 43, 'Pul Chowk'), (1, 43, 'Putalisadak Area'), (1, 43, 'Rameshwor Mandir'), (1, 43, 'Ramghat'),
(1, 43, 'Ramngar'), (1, 43, 'Rampur'), (1, 43, 'Shahid Chowk Area'), (1, 43, 'Sharadpur'),
(1, 43, 'Shivaghat'), (1, 43, 'Thulo Balkumari Area'), (1, 43, 'Tiger Chowk'), (1, 43, 'Tri Chowk'), (1, 43, 'Yagya Puri');

-- 2. Nuwakot (Bidur) Landmarks for branch_id 37
INSERT INTO landmarks (company_id, branch_id, name) VALUES
(1, 37, 'Bidur'), (1, 37, 'Aapghari'), (1, 37, 'Bandre'), (1, 37, 'Battar Bazar'), (1, 37, 'Battar Buspark'),
(1, 37, 'Betrawati'), (1, 37, 'Bidur Prahari Beat'), (1, 37, 'Bogati Gaau'), (1, 37, 'Buspark Area'),
(1, 37, 'Cdo Oficce Area'), (1, 37, 'Colony Chauki Area'), (1, 37, 'Damki Chowk'), (1, 37, 'Deurali Chowk'),
(1, 37, 'Devighat Bazar'), (1, 37, 'Dhikure Bazar'), (1, 37, 'Dhunge'), (1, 37, 'Ghantaghar'),
(1, 37, 'Hattigauda Chowk'), (1, 37, 'Hawaghar'), (1, 37, 'Hospital Road'), (1, 37, 'Jd Boarding Area'),
(1, 37, 'Jharpati'), (1, 37, 'Kingtang Tol'), (1, 37, 'Loktantrik Chowk'), (1, 37, 'Macchapokhari/ Siltyanki'),
(1, 37, 'Macchapuchre Bank Chowk'), (1, 37, 'Majhitar'), (1, 37, 'Mathillo Bidur'), (1, 37, 'Om Mane Peme Chowk'),
(1, 37, 'Panchakanya'), (1, 37, 'Phulbari'), (1, 37, 'Pipaltar'), (1, 37, 'Raising'), (1, 37, 'Sichai/ Maharani D'),
(1, 37, 'Simutar'), (1, 37, 'Sole Bazar'), (1, 37, 'Sp Office'), (1, 37, 'Subha Ghat'),
(1, 37, 'Trishuli Bhitri Bazaar'), (1, 37, 'Trishuli Dhunge'), (1, 37, 'Tupche');

-- 3. Makwanpur (Hetauda) Landmarks for branch_id 39
INSERT INTO landmarks (company_id, branch_id, name) VALUES
(1, 39, 'Chaughda'), (1, 39, 'Chaughdaa'), (1, 39, 'Chucheekhola'), (1, 39, 'Gardaaiiee'), (1, 39, 'Haitya Gabisha'),
(1, 39, 'Hetauda'), (1, 39, 'Basamadi'), (1, 39, 'Bastipur'), (1, 39, 'Buddha Chowk'), (1, 39, 'Campa Dhada'),
(1, 39, 'Cement Factory Area'), (1, 39, 'Hetauda Cement Road'), (1, 39, 'Cement Road'), (1, 39, 'Chaughara Bazar'),
(1, 39, 'Chauki Tole Area'), (1, 39, 'Chaukitol'), (1, 39, 'China Quarters Area'), (1, 39, 'Chisapani'),
(1, 39, 'Dangdunge'), (1, 39, 'Eye Hospital Area'), (1, 39, 'Forestry Institute Area'), (1, 39, 'Golpingtar Area'),
(1, 39, 'Hatigauda'), (1, 39, 'Hetauda Adhyugik Area'), (1, 39, 'Kamana Chowk'), (1, 39, 'Kanti Rajpath'),
(1, 39, 'Main Road'), (1, 39, 'Sanopokhara'), (1, 39, 'Thanabharyang');

-- 4. Rupandehi (Butwal) Landmarks for branch_id 1
INSERT INTO landmarks (company_id, branch_id, name) VALUES
(1, 1, 'Traffic Chowk'), (1, 1, 'Milanchowk'), (1, 1, 'Golpark'), (1, 1, 'Belbas'),
(1, 1, 'Kalikanagar'), (1, 1, 'Hospital Line'), (1, 1, 'Amarpath'), (1, 1, 'Devinagar'),
(1, 1, 'Drivertole'), (1, 1, 'Sukhanagar'), (1, 1, 'Deepnagar'), (1, 1, 'Haatbazaar'),
(1, 1, 'Yogikutir'), (1, 1, 'Manigram'), (1, 1, 'Shankarnagar'), (1, 1, 'Kotihawa'), (1, 1, 'Bhairahawa');

-- 5. Kathmandu Landmarks for branch_id 2
INSERT INTO landmarks (company_id, branch_id, name) VALUES
(1, 2, 'New Road'), (1, 2, 'Thamel'), (1, 2, 'Baneshwor'), (1, 2, 'Koteshwor'),
(1, 2, 'Kalanki'), (1, 2, 'Chabahil'), (1, 2, 'Maharajgunj'), (1, 2, 'Putalisadak'),
(1, 2, 'Durbarmarg'), (1, 2, 'Tripureshwor'), (1, 2, 'Baluwatar'), (1, 2, 'Lazimpat'),
(1, 2, 'Kupondole'), (1, 2, 'Jawalakhel'), (1, 2, 'Lagankhel'), (1, 2, 'Boudha'), (1, 2, 'Gongabu');
